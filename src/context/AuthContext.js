import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

const makeDefaultUsername = (email = '') => (email || `user_${Date.now()}`).split('@')[0];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

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

  const register = useCallback(async ({ email, password }) => {
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
    setIsNewUser(true);
  }, []);

  const login = useCallback(({ email, password }) => signInWithEmailAndPassword(auth, email, password), []);

  const logout = useCallback(() => signOut(auth), []);

  const updateUserProfile = useCallback(async ({ username, photoURL }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const updates = {
      username: username || profile?.username || '',
      photoURL: photoURL || profile?.photoURL || '',
    };
    await updateProfile(currentUser, { displayName: updates.username, photoURL: updates.photoURL });
    await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    setProfile((current) => ({ ...current, ...updates }));
  }, [profile]);

  const value = useMemo(
    () => ({ user, profile, loading, register, login, logout, updateUserProfile, isNewUser, setIsNewUser }),
    [user, profile, loading, register, login, logout, updateUserProfile, isNewUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
