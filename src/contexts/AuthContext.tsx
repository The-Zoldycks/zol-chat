import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../services/firebase';
import { setUserOnline, setUserOffline } from '../services/chatService';

const PROFILE_CACHE_KEY = 'zol_user_profile';
const CHATS_CACHE_KEY = 'zol_chats_cache';

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

function profileFromFirebaseUser(firebaseUser: User): UserProfile {
  const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    username,
    usernameLower: username.toLowerCase(),
    photoURL: firebaseUser.photoURL || '',
  };
}

function getEffectiveProfile(userProfile: UserProfile | null, user: User | null): UserProfile {
  if (userProfile) return userProfile;
  if (user) return profileFromFirebaseUser(user);
  return { uid: '', email: '', username: 'User', usernameLower: 'user', photoURL: '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const profileWriteRef = useRef(0);
  const profilePendingRef = useRef(0);

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

  // Preload cached profile immediately on mount so UI has profile instantly
  useEffect(() => {
    AsyncStorage.getItem(PROFILE_CACHE_KEY).then((cached) => {
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.uid && parsed.username) {
            setUserProfile((curr) => curr || parsed);
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Set immediate fallback from Firebase user (unless a profile write is
        // in flight - that state is fresher than anything derived here)
        const fallbackProfile = profileFromFirebaseUser(firebaseUser);
        if (profilePendingRef.current === 0) {
          setUserProfile(fallbackProfile);
        }

        // Try getting cached profile first to avoid flickering
        try {
          const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.uid === firebaseUser.uid && parsed.username) {
              if (profilePendingRef.current === 0) {
                setUserProfile((current) => (current?.photoURL ? current : parsed));
              }
            }
          }
        } catch {}

        // Fetch fresh profile from Firestore
        try {
          const versionAtFetch = profileWriteRef.current;
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profilePendingRef.current === 0 && profileWriteRef.current === versionAtFetch) {
            if (userDoc.exists()) {
              const profile = userDoc.data() as UserProfile;
              if (profile && profile.username) {
                setUserProfile(profile);
                await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)).catch(() => {});
              } else {
                // Firestore doc exists but missing username - write the fallback
                const fixedProfile = { ...fallbackProfile };
                await setDoc(doc(db, 'users', firebaseUser.uid), {
                  ...fixedProfile,
                  createdAt: serverTimestamp(),
                }, { merge: true });
                setUserProfile(fixedProfile);
                await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fixedProfile)).catch(() => {});
              }
            } else {
              // No Firestore doc - create one
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                ...fallbackProfile,
                createdAt: serverTimestamp(),
              });
              setUserProfile(fallbackProfile);
              await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(fallbackProfile)).catch(() => {});
            }
          }
        } catch {
          // If Firestore is offline or fails, keep whatever profile we have
          setUserProfile((current) => {
            if (current && current.uid === firebaseUser.uid && current.username && current.username !== 'User') return current;
            return fallbackProfile;
          });
        }
      } else {
        setUserProfile(null);
        await AsyncStorage.removeItem(PROFILE_CACHE_KEY).catch(() => {});
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
    // Set displayName on Firebase Auth user so fallbacks work
    try {
      await firebaseUpdateProfile(cred.user, { displayName: username });
    } catch {}
    await setDoc(doc(db, 'users', cred.user.uid), {
      ...profile,
      createdAt: serverTimestamp(),
    });
    setUserProfile(profile);
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)).catch(() => {});
  };

  const signOut = async () => {
    if (user) await setUserOffline(user.uid).catch(() => {});
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY).catch(() => {});
    // Also clear chats cache so next user doesn't see stale data
    await AsyncStorage.removeItem(CHATS_CACHE_KEY).catch(() => {});
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const current = getEffectiveProfile(userProfile, user);
    const merged = { ...current, ...updates } as UserProfile;
    if (updates.username) {
      merged.usernameLower = updates.username.toLowerCase();
    }
    profilePendingRef.current += 1;
    // Reflect changes immediately so the UI updates without waiting on the network
    setUserProfile(merged);
    try {
      if (updates.username) {
        // Also update Firebase Auth displayName
        try {
          await firebaseUpdateProfile(user, { displayName: updates.username });
        } catch {}
      }
      if (updates.photoURL) {
        try {
          await firebaseUpdateProfile(user, { photoURL: updates.photoURL });
        } catch {}
      }

      try {
        await setDoc(doc(db, 'users', user.uid), merged, { merge: true });
      } catch (e) {
        // Persist failed - roll back so the UI isn't showing an unsaved profile
        setUserProfile(current);
        throw e;
      }

      // Mark the write as complete so any in-flight auth-listener fetch
      // that read stale data knows not to overwrite the fresher profile.
      // Re-assert the merged profile last so it wins over any stale listener write.
      profileWriteRef.current += 1;
      setUserProfile(merged);
      await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(merged)).catch(() => {});
    } finally {
      profilePendingRef.current -= 1;
    }
  };

  // Expose a method to get the effective profile (with fallback)
  const effectiveProfile = getEffectiveProfile(userProfile, user);

  return (
    <AuthContext.Provider value={{ user, userProfile: effectiveProfile, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
