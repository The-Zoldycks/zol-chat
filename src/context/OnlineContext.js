import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './AuthContext';

const OnlineContext = createContext();

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function OnlineProvider({ children }) {
  const { user } = useAuth();
  const [presenceMap, setPresenceMap] = useState({});

  useEffect(() => {
    if (!user?.uid) return;
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', user.uid));
    const unsubscribes = [];

    const unsubChats = onSnapshot(q, (snapshot) => {
      unsubscribes.forEach((u) => u());
      unsubscribes.length = 0;

      snapshot.forEach((chatDoc) => {
        const chatId = chatDoc.id;
        const presenceRef = collection(db, 'chats', chatId, 'presence');
        const unsubPresence = onSnapshot(presenceRef, (snap) => {
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.uid !== user.uid && data.lastActive) {
              const lastActive = data.lastActive?.toDate
                ? data.lastActive.toDate()
                : new Date(data.lastActive);
              const isOnline = Date.now() - lastActive.getTime() < ONLINE_THRESHOLD_MS;
              setPresenceMap((prev) => ({
                ...prev,
                [data.uid]: { isOnline, lastActive, typing: data.typing || false },
              }));
            }
          });
        });
        unsubscribes.push(unsubPresence);
      });
    });

    return () => {
      unsubChats();
      unsubscribes.forEach((u) => u());
    };
  }, [user?.uid]);

  const isOnline = useCallback((uid) => presenceMap[uid]?.isOnline || false, [presenceMap]);
  const isTyping = useCallback((uid) => presenceMap[uid]?.typing || false, [presenceMap]);

  const value = useMemo(() => ({ isOnline, isTyping, presenceMap }), [isOnline, isTyping, presenceMap]);

  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export const useOnline = () => {
  const ctx = useContext(OnlineContext);
  if (!ctx) throw new Error('useOnline must be used within an OnlineProvider');
  return ctx;
};
