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
import { db } from './firebase';

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
  });
}

export function subscribeToMessages(chatId, onData) {
  const messageQuery = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(messageQuery, (snapshot) => {
    onData(snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() })));
  });
}

export async function sendMessage(chatId, sender, text) {

  const trimmed = text.trim();
  if (!trimmed) return;

  // Make sure the chat room document exists in Firestore if it's Zolbot
  if (chatId.startsWith('zolbot__')) {
    const chatRef = doc(db, 'chats', chatId);
    const existing = await getDoc(chatRef);
    if (!existing.exists()) {
      await setDoc(chatRef, {
        id: chatId,
        participants: [sender.uid, 'zolbot'],
        participantMeta: {
          [sender.uid]: {
            email: sender.email,
            username: sender.username || sender.email,
            photoURL: sender.photoURL || '',
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
    senderId: sender.uid,
    senderEmail: sender.email,
    senderUsername: sender.username || sender.email,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: trimmed,
    updatedAt: serverTimestamp(),
  });

  // If chat is with Zolbot, trigger the AI response in the background
  if (chatId.startsWith('zolbot__')) {
    respondWithBot(chatId, sender);
  }
}

async function respondWithBot(chatId, userProfile) {
  try {
    // 1. Fetch recent messages for context
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(15));
    const querySnapshot = await getDocs(q);

    const history = [];
    querySnapshot.forEach((docSnap) => {
      history.push(docSnap.data());
    });
    // Sort chronologically
    history.reverse();

    // 2. Format history for Groq API
    const groqMessages = [
      {
        role: 'system',
        content: `You are Zolbot, a friendly and helpful AI chatbot integrated directly into the Zol Chat app.
You are chatting with ${userProfile.username || 'user'}. 

Here is some basic information about Zol Chat to help you answer questions:
- What is Zol Chat: A real-time chat mobile application built using React Native, Expo, Firebase (Authentication, Firestore, Storage), and React Native Paper for premium UI design.
- How to add chats: Tap the purple Floating Action Button (+) on the bottom right of the chats list, and search for other users by their email or username.
- How to customize profile: Navigate to the Settings tab (gear icon on bottom navigation) to update your username or set a profile photo.
- Theme: The app runs in a premium space-themed dark mode (featuring dark indigo backgrounds and purple/violet accents).

Keep your responses engaging, helpful, and concise (appropriate for a chat room bubble). If the user asks about the app's features or how to use it, refer to the guides above.`,
      },
      ...history.map((msg) => ({
        role: msg.senderId === 'zolbot' ? 'assistant' : 'user',
        content: msg.text,
      })),
    ];

    // 3. Make request to Groq API
    const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
      console.warn("Groq API key is missing. Add EXPO_PUBLIC_GROQ_API_KEY to your .env file.");
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: "Hi! I'm ready to chat, but my API key is not configured yet! Please ask the developer to add `EXPO_PUBLIC_GROQ_API_KEY` to the `.env` file.",
        senderId: 'zolbot',
        senderEmail: 'zolbot@zoldyck.ai',
        senderUsername: 'Zolbot',
        createdAt: serverTimestamp(),
      });
      return;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: status ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const botText = data.choices?.[0]?.message?.content || "Sorry, I had trouble parsing the response.";

    // 4. Save bot's reply in Firestore
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: botText,
      senderId: 'zolbot',
      senderEmail: 'zolbot@zoldyck.ai',
      senderUsername: 'Zolbot',
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: botText,
      updatedAt: serverTimestamp(),
    });

  } catch (error) {
    console.error("Error generating Zolbot response:", error);
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: "Oops, I ran into an error trying to connect to the brain! Please make sure your network and Groq configuration are correct.",
      senderId: 'zolbot',
      senderEmail: 'zolbot@zoldyck.ai',
      senderUsername: 'Zolbot',
      createdAt: serverTimestamp(),
    });
  }
}

