import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppState, type AppStateStatus } from 'react-native';
import { auth, db } from '../services/firebase';
import { setUserOnline, setUserOffline } from '../services/chatService';

interface UserProfile {
  uid: string;
  email: string;
  username: string;
  usernameLower: string;
  photoURL: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    setUserOnline(user.uid).catch(() => {});
    heartbeatRef.current = setInterval(() => {
      setUserOnline(user.uid).catch(() => {});
    }, 30000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setUserOnline(user.uid).catch(() => {});
      } else {
        setUserOffline(user.uid).catch(() => {});
      }
      appState.current = next;
    });
    return () => {
      sub.remove();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      setUserOffline(user.uid).catch(() => {});
    };
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            username: firebaseUser.email?.split('@')[0] || 'User',
            usernameLower: (firebaseUser.email?.split('@')[0] || 'user').toLowerCase(),
            photoURL: '',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            ...profile,
            createdAt: serverTimestamp(),
          });
          setUserProfile(profile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, username: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile: UserProfile = {
      uid: cred.user.uid,
      email,
      username,
      usernameLower: username.toLowerCase(),
      photoURL: '',
    };
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });
    setUserProfile(profile);
  };

  const signOut = async () => {
    if (user) await setUserOffline(user.uid).catch(() => {});
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const merged = { ...userProfile, ...updates } as UserProfile;
    if (updates.username) {
      merged.usernameLower = updates.username.toLowerCase();
    }
    await setDoc(doc(db, 'users', user.uid), merged, { merge: true });
    setUserProfile(merged);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
