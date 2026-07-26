import {
  addDoc,
  collection,
  deleteDoc,
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

export const GLOBAL_CHAT_ID = 'global_chat';

export async function ensureGlobalChatExists() {
  const ref = doc(db, 'chats', GLOBAL_CHAT_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      id: GLOBAL_CHAT_ID,
      participants: [],
      participantMeta: {},
      lastMessage: 'Welcome to Global Chat! Say hello 👋',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      isGlobal: true,
    });
  }
}

export async function purgeOldGlobalMessages() {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const msgsRef = collection(db, 'chats', GLOBAL_CHAT_ID, 'messages');
  try {
    const snap = await getDocs(msgsRef);
    const deletePromises = [];
    snap.forEach((msgSnap) => {
      const data = msgSnap.data();
      let ts = 0;
      if (data.createdAt?.toDate) ts = data.createdAt.toDate().getTime();
      else if (data.createdAt?.seconds) ts = data.createdAt.seconds * 1000;
      else if (data.createdAt) ts = new Date(data.createdAt).getTime();
      if (ts && ts < cutoff) {
        deletePromises.push(deleteDoc(doc(db, 'chats', GLOBAL_CHAT_ID, 'messages', msgSnap.id)));
      }
    });
    await Promise.all(deletePromises);
  } catch {
    // Purge fails silently if offline or rules block
  }
}

export const chatIdFromUsers = (uidA, uidB) => [uidA, uidB].sort().join('__');

export async function findUsersByEmailOrUsername(term, currentUid) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return [];

  const usersRef = collection(db, 'users');
  const queries = await Promise.all([
    getDocs(query(usersRef, where('email', '==', normalized), limit(10))),
    getDocs(query(usersRef, where('usernameLower', '==', normalized), limit(10))),
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

  if (map.size === 0) {
    const allSnap = await getDocs(query(usersRef, limit(50)));
    allSnap.forEach((docSnap) => {
      const user = docSnap.data();
      if (user.uid !== currentUid) {
        const u = (user.username || '').toLowerCase();
        const e = (user.email || '').toLowerCase();
        if (u.includes(normalized) || e.includes(normalized)) {
          map.set(user.uid, user);
        }
      }
    });
  }

  return [...map.values()];
}

export async function startOrOpenChat(currentUser, targetUser) {
  const chatId = chatIdFromUsers(currentUser.uid, targetUser.uid);
  const chatRef = doc(db, 'chats', chatId);
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
  }, { merge: true });
  return chatId;
}

export async function createGroupChat({ groupName, participants, creator }) {
  const trimmedName = groupName.trim();
  if (!trimmedName) throw new Error('Group name cannot be empty');

  const creatorUid = creator?.uid || 'user';
  const allParticipants = Array.from(new Set([creatorUid, ...participants]));

  const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const participantMeta = {
    [creatorUid]: {
      email: creator?.email || '',
      username: creator?.username || creator?.displayName || 'User',
      photoURL: creator?.photoURL || '',
    },
  };

  for (const pUid of allParticipants) {
    if (pUid === 'zolbot') {
      participantMeta.zolbot = {
        email: 'zolbot@zoldyck.ai',
        username: 'Zolbot',
        photoURL: '',
        isBot: true,
      };
    } else if (!participantMeta[pUid]) {
      try {
        const uSnap = await getDoc(doc(db, 'users', pUid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          participantMeta[pUid] = {
            email: uData.email || '',
            username: uData.username || uData.email || 'User',
            photoURL: uData.photoURL || '',
          };
        }
      } catch {
        participantMeta[pUid] = { email: '', username: 'User', photoURL: '' };
      }
    }
  }

  const groupData = {
    id: groupId,
    isGroup: true,
    groupName: trimmedName,
    groupAdmins: [creatorUid],
    participants: allParticipants,
    participantMeta,
    lastMessage: 'Group created 🎉',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'chats', groupId), groupData);
  return groupId;
}

export async function clearChatMessages(chatId) {
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  const snap = await getDocs(msgsRef);
  const deletePromises = [];
  snap.forEach((docSnap) => {
    deletePromises.push(deleteDoc(doc(db, 'chats', chatId, 'messages', docSnap.id)));
  });
  await Promise.all(deletePromises);

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: 'Chat cleared',
    updatedAt: serverTimestamp(),
  });
}

export async function addGroupMembers(chatId, newMemberUids) {
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const currentParticipants = data.participants || [];
  const updatedParticipants = Array.from(new Set([...currentParticipants, ...newMemberUids]));

  const participantMeta = { ...(data.participantMeta || {}) };
  for (const uid of newMemberUids) {
    if (uid === 'zolbot') {
      participantMeta.zolbot = {
        email: 'zolbot@zoldyck.ai',
        username: 'Zolbot',
        photoURL: '',
        isBot: true,
      };
    } else if (!participantMeta[uid]) {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          participantMeta[uid] = {
            email: uData.email || '',
            username: uData.username || uData.email || 'User',
            photoURL: uData.photoURL || '',
          };
        }
      } catch {
        participantMeta[uid] = { email: '', username: 'User', photoURL: '' };
      }
    }
  }

  await updateDoc(chatRef, {
    participants: updatedParticipants,
    participantMeta,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleGroupAdmin(chatId, targetUid, makeAdmin) {
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  const data = snap.data();
  let admins = data.groupAdmins || [];
  if (makeAdmin) {
    if (!admins.includes(targetUid)) admins.push(targetUid);
  } else {
    admins = admins.filter((a) => a !== targetUid);
  }
  await updateDoc(chatRef, { groupAdmins: admins });
}

export async function leaveGroup(chatId, uid) {
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) return;
  const data = snap.data();
  const participants = (data.participants || []).filter((p) => p !== uid);
  const groupAdmins = (data.groupAdmins || []).filter((a) => a !== uid);

  if (participants.length === 0) {
    await deleteDoc(chatRef);
  } else {
    let finalAdmins = groupAdmins;
    if (finalAdmins.length === 0 && participants.length > 0) {
      finalAdmins = [participants[0]];
    }
    await updateDoc(chatRef, {
      participants,
      groupAdmins: finalAdmins,
      updatedAt: serverTimestamp(),
    });
  }
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
    let docs = snapshot.docs.map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }));
    if (chatId === GLOBAL_CHAT_ID) {
      const cutoff = Date.now() - 72 * 60 * 60 * 1000;
      docs = docs.filter((msg) => {
        let ts = 0;
        if (msg.createdAt?.toDate) ts = msg.createdAt.toDate().getTime();
        else if (msg.createdAt?.seconds) ts = msg.createdAt.seconds * 1000;
        else if (msg.createdAt) ts = new Date(msg.createdAt).getTime();
        return !ts || ts >= cutoff;
      });
      purgeOldGlobalMessages().catch(() => {});
    }
    onData(docs);
  }, () => {
    onData([]);
  });
}

export async function markChatAsRead(chatId, uid) {
  const chatRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatRef, {
      [`participantMeta.${uid}.lastRead`]: new Date(),
    });
  } catch {
    // Chat may not exist yet
  }
}

export async function getUnreadCounts(uid, chats) {
  const counts = {};
  await Promise.all(
    chats.map(async (chat) => {
      try {
        const lastRead = chat.participantMeta?.[uid]?.lastRead;
        const messagesSnap = await getDocs(
          query(
            collection(db, 'chats', chat.id, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(50),
          )
        );
        let count = 0;
        if (!lastRead) {
          messagesSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.senderId !== uid) count++;
          });
        } else {
          const lastReadDate = lastRead?.toDate ? lastRead.toDate() : new Date(lastRead);
          messagesSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.senderId !== uid) {
              const msgDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || 0);
              if (msgDate > lastReadDate) count++;
            }
          });
        }
        counts[chat.id] = count;
      } catch {
        counts[chat.id] = 0;
      }
    })
  );
  return counts;
}

export async function sendMessage(chatId, sender, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';

  if (chatId.startsWith('zolbot__')) {
    await setDoc(doc(db, 'chats', chatId), {
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
    }, { merge: true });
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

  if (chatId.startsWith('zolbot__')) {
    respondWithBot(chatId, { uid: senderId, email: senderEmail, username: senderUsername });
  } else if (chatId.startsWith('group_')) {
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (chatSnap.exists() && chatSnap.data()?.participants?.includes('zolbot')) {
      respondWithBot(chatId, { uid: senderId, email: senderEmail, username: senderUsername });
    }
  }
}

async function respondWithBot(chatId, userProfile) {
  try {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(15));
    const querySnapshot = await getDocs(q);

    const history = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.text) {
        history.push(data);
      }
    });
    history.reverse();

    const username = userProfile?.username || userProfile?.email || 'User';

    const groqMessages = [
      {
        role: 'system',
        content: `You are Zolbot, a friendly and helpful AI chatbot built into the Zol Chat app by the Zoldyck team. You are chatting with ${username}.

== ABOUT ZOL CHAT ==
Zol Chat is a real-time messaging app built with React Native, Expo (SDK 54), Firebase (Auth + Firestore), Cloudinary (image uploads), and React Native Paper. It uses a premium dark space theme with deep indigo backgrounds and purple/violet accents.

== APP NAVIGATION ==
- The app has two main tabs: Chats (chat bubble icon) and Settings (gear icon).
- Bottom tab bar shows an unread message badge if you have unread messages.
- Tap any chat in the list to open the conversation.

== CHAT FEATURES ==
- Send text messages in real-time.
- Send images: tap the image icon in the message composer to pick from your gallery.
- Emoji picker: tap the smiley icon to browse and insert emojis into your message.
- Long-press any message to open options: Copy, Forward, or Delete (own messages only).
- Forward messages to any other chat from the long-press menu.
- Links in messages are tappable and open in your browser.
- Messages show timestamps.
- Typing indicators: when the other person is typing, you see "typing..." under their name in the header.
- Online status: a green dot appears next to users who are currently online.
- Unread badges on the chat list show how many unread messages you have per chat.
- Pull down on the chat list to refresh.

== ZOLBOT (YOU!) ==
- Zolbot is a special AI chat, always pinned at the top of the chat list.
- Zolbot uses the Groq API with the Llama 3.3 70B model.
- You have a 5-second cooldown between messages to prevent spam.
- You are always available — every user has a Zolbot chat automatically.
- If you encounter an error, you report it honestly.

== PROFILE & SETTINGS ==
- Navigate to the Settings tab to update your profile.
- Change your display username (shown in chats and to other users).
- Upload or change your profile photo (via camera/gallery picker, stored on Cloudinary).
- Toggle Dark Mode on/off with the switch — the app supports both dark and light themes.
- Log Out button to sign out.

== FINDING USERS ==
- Tap the purple Floating Action Button (+) on the Chats screen.
- Search for users by their email address or username.
- Tap a search result to start a new chat with that person.

== GLOBAL CHAT ==
- Global Chat is a public room where every user can send messages.
- It appears at the top of your chat list with a 🌍 globe icon and green name.
- Anyone in the app can read and send messages here — no invite needed.
- Great for meeting new people, making announcements, or casual group conversation.

== SECURITY ==
- Authentication uses Firebase Auth (email + password).
- Messages are stored in Firestore with per-chat security rules.
- Each chat is accessible only to its participants.

== YOUR PERSONALITY ==
- You are knowledgeable about all Zol Chat features and can guide users step-by-step.
- You are friendly, concise, and helpful — keep responses appropriate for chat bubbles (1-3 paragraphs max).
- If asked about something outside the app, you can answer generally but always bring it back to how Zol Chat can help.
- You can suggest tips and tricks for using the app effectively.
- If a user seems confused, ask clarifying questions and walk them through it patiently.`,
      },
      ...history.map((msg) => ({
        role: msg.senderId === 'zolbot' ? 'assistant' : 'user',
        content: msg.text,
      })),
    ];

    const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
    if (!apiKey) {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: "Hi! I'm ready to chat, but my API key is not configured yet!",
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
      const errText = await response.text();
      throw new Error(`Groq API status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const botText = data.choices?.[0]?.message?.content || "Sorry, I had trouble parsing the response.";

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

  } catch (err) {
    const detail = err?.message || 'Unknown error';
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: `Oops, I ran into an error: ${detail}`,
      senderId: 'zolbot',
      senderEmail: 'zolbot@zoldyck.ai',
      senderUsername: 'Zolbot',
      createdAt: serverTimestamp(),
    });
  }
}

export async function deleteMessage(chatId, messageId) {
  await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
}

export async function deleteChat(chatId) {
  await deleteDoc(doc(db, 'chats', chatId));
}

export async function forwardMessage(targetChatId, sender, originalText, originalImageUrl) {
  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';

  const text = originalText ? `Forwarded: ${originalText}` : '';

  await addDoc(collection(db, 'chats', targetChatId, 'messages'), {
    text,
    imageUrl: originalImageUrl || null,
    senderId,
    senderEmail,
    senderUsername,
    createdAt: serverTimestamp(),
    forwarded: true,
  });

  await updateDoc(doc(db, 'chats', targetChatId), {
    lastMessage: originalImageUrl ? '📷 Photo' : text,
    updatedAt: serverTimestamp(),
  });
}

export async function sendImageMessage(chatId, sender, imageUrl) {
  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';

  if (chatId.startsWith('zolbot__')) {
    await setDoc(doc(db, 'chats', chatId), {
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
    }, { merge: true });
  }

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text: '',
    imageUrl,
    senderId,
    senderEmail,
    senderUsername,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: '📷 Photo',
    updatedAt: serverTimestamp(),
  });
}

export function setTyping(chatId, uid, isTyping) {
  const presenceRef = doc(db, 'chats', chatId, 'presence', uid);
  return setDoc(presenceRef, {
    uid,
    typing: isTyping,
    lastActive: new Date(),
  }, { merge: true });
}

export function subscribeToPresence(chatId, uid, onPresenceChange) {
  const presenceRef = collection(db, 'chats', chatId, 'presence');
  return onSnapshot(presenceRef, (snapshot) => {
    const presence = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.uid !== uid) {
        presence[data.uid] = data;
      }
    });
    onPresenceChange(presence);
  }, () => {
    onPresenceChange({});
  });
}

export async function clearPresence(chatId, uid) {
  if (!chatId || !uid) return;
  try {
    const presenceRef = doc(db, 'chats', chatId, 'presence', uid);
    await deleteDoc(presenceRef);
  } catch {
    // Presence cleanup is best-effort
  }
}

