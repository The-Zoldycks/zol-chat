import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';

const functions = getFunctions();
const groqChat = httpsCallable(functions, 'groqChat');

const chatsCollection = collection(db, 'chats');

export const chatIdFromUsers = (uidA, uidB) => [uidA, uidB].sort().join('__');

export async function findUsersByEmailOrUsername(term, currentUid) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  const usersRef = collection(db, 'users');
  const queries = await Promise.all([
    getDocs(query(usersRef, where('email', '==', normalized), limit(5))),
    getDocs(query(usersRef, where('username', '==', normalized), limit(5))),
  ]);

  const map = new Map();
  queries.forEach((snap) => {
    snap.forEach((docSnap) => {
      const user = docSnap.data();
      if (user.uid !== currentUid) {
        map.set(user.uid, user);
      }
    });
  });

  return [...map.values()];
}

export async function startOrOpenChat(currentUser, targetUser) {
  const chatId = chatIdFromUsers(currentUser.uid, targetUser.uid);
  const chatRef = doc(db, 'chats', chatId);
  const existing = await getDoc(chatRef);
  if (!existing.exists()) {
    await setDoc(chatRef, {
      id: chatId,
      participants: [currentUser.uid, targetUser.uid],
      participantMeta: {
        [currentUser.uid]: {
          email: currentUser.email,
          username: currentUser.username,
          photoURL: currentUser.photoURL || '',
        },
        [targetUser.uid]: {
          email: targetUser.email,
          username: targetUser.username,
          photoURL: targetUser.photoURL || '',
        },
      },
      lastMessage: '',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }
  return chatId;
}

export function subscribeToChats(uid, onData) {
  const chatQuery = query(chatsCollection, where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(chatQuery, (snapshot) => {
    onData(snapshot.docs.map((chatDoc) => chatDoc.data()));
  }, () => {
    onData([]);
  });
}

export function subscribeToMessages(chatId, onData) {
  const messageQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(messageQuery, (snapshot) => {
    onData(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })));
  }, () => {
    onData([]);
  });
}

export async function sendMessage(chatId, sender, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';

  // Make sure the chat room document exists in Firestore if it's Zolbot
  if (chatId.startsWith('zolbot__')) {
    const chatRef = doc(db, 'chats', chatId);
    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
      await setDoc(chatRef, {
        id: chatId,
        participants: [senderId, 'zolbot'],
        participantMeta: {
          [senderId]: {
            email: senderEmail,
            username: senderUsername,
            photoURL: sender?.photoURL || '',
          },
          zolbot: {
            email: 'zolbot@zoldyck.ai',
            username: 'Zolbot',
            photoURL: '',
            isBot: true,
          },
        },
        lastMessage: '',
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  }

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text: trimmed,
    senderId: senderId,
    senderEmail: senderEmail,
    senderUsername: senderUsername,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: trimmed,
    updatedAt: serverTimestamp(),
  });

  // If chat is with Zolbot, trigger the AI response in the background
  if (chatId.startsWith('zolbot__')) {
    respondWithBot(chatId);
  }
}

async function respondWithBot(chatId) {
  try {
    await groqChat({ chatId });
  } catch {
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: "Oops, I ran into an error trying to connect to my AI brain! Please check your network connection.",
      senderId: 'zolbot',
      senderEmail: 'zolbot@zoldyck.ai',
      senderUsername: 'Zolbot',
      createdAt: serverTimestamp(),
    });
  }
}

