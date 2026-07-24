import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  const profileRef = useRef(null);
  profileRef.current = profile;

  const dismissNewUser = useCallback(() => setIsNewUser(false), []);

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
          }, { merge: true });
          await updateProfile(authUser, { displayName: username });
          setProfile({ uid: authUser.uid, email: authUser.email, username, photoURL: authUser.photoURL || '' });
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
    setIsNewUser(true);
  }, []);

  const login = useCallback(({ email, password }) => signInWithEmailAndPassword(auth, email, password), []);

  const logout = useCallback(() => signOut(auth), []);

  const updateUserProfile = useCallback(async ({ username, photoURL }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const current = profileRef.current;
    const updates = {
      username: username || current?.username || '',
      photoURL: photoURL || current?.photoURL || '',
    };
    await updateProfile(currentUser, { displayName: updates.username, photoURL: updates.photoURL });
    await setDoc(doc(db, 'users', currentUser.uid), updates, { merge: true });
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo(
    () => ({ user, profile, loading, register, login, logout, updateUserProfile, isNewUser, dismissNewUser }),
    [user, profile, loading, register, login, logout, updateUserProfile, isNewUser, dismissNewUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
