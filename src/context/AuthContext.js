import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

const makeDefaultUsername = (email = '') => email.split('@')[0] || `user_${Date.now()}`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const profileRef = doc(db, 'users', authUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (!profileSnap.exists()) {
          const username = makeDefaultUsername(authUser.email);
          await setDoc(profileRef, {
            uid: authUser.uid,
            email: authUser.email,
            username,
            photoURL: authUser.photoURL || '',
            createdAt: serverTimestamp(),
          });
          await updateProfile(authUser, { displayName: username });
          setProfile({ uid: authUser.uid, email: authUser.email, username, photoURL: '' });
        } else {
          setProfile(profileSnap.data());
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const register = async ({ email, password }) => {
    const response = await createUserWithEmailAndPassword(auth, email, password);
    const username = makeDefaultUsername(email);
    await updateProfile(response.user, { displayName: username });
    await setDoc(doc(db, 'users', response.user.uid), {
      uid: response.user.uid,
      email,
      username,
      photoURL: '',
      createdAt: serverTimestamp(),
    });
  };

  const login = ({ email, password }) => signInWithEmailAndPassword(auth, email, password);

  const logout = () => signOut(auth);

  const updateUserProfile = async ({ username, photoURL }) => {
    if (!user) return;
    const updates = {
      username: username || profile?.username || '',
      photoURL: photoURL || profile?.photoURL || '',
    };
    await updateProfile(user, { displayName: updates.username, photoURL: updates.photoURL });
    await updateDoc(doc(db, 'users', user.uid), updates);
    setProfile((current) => ({ ...current, ...updates }));
  };

  const value = useMemo(
    () => ({ user, profile, loading, register, login, logout, updateUserProfile }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
