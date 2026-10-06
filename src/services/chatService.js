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
  runTransaction,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { cacheMessages, getCachedMessages, clearCachedMessages } from './localMessageCache';
import { cacheChats, getCachedChats } from './localChatsCache';

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

let lastGlobalPurgeAt = 0;

export async function purgeOldGlobalMessages() {
  // Throttle: at most once every 5 minutes. This used to fetch EVERY global
  // message on EVERY snapshot, which made global chat progressively slower.
  const now = Date.now();
  if (now - lastGlobalPurgeAt < 5 * 60 * 1000) return;
  lastGlobalPurgeAt = now;
  const cutoff = now - 72 * 60 * 60 * 1000;
  try {
    // Only inspect the oldest messages instead of downloading the whole room.
    const snap = await getDocs(
      query(collection(db, 'chats', GLOBAL_CHAT_ID, 'messages'), orderBy('createdAt', 'asc'), limit(100))
    );
    const batch = writeBatch(db);
    let ops = 0;
    snap.forEach((msgSnap) => {
      const ts = getTimestampMs(msgSnap.data().createdAt);
      if (ts && ts < cutoff) {
        batch.delete(doc(db, 'chats', GLOBAL_CHAT_ID, 'messages', msgSnap.id));
        ops++;
      }
    });
    if (ops > 0) await batch.commit();
  } catch {
    // Purge fails silently if offline or rules block
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getTimestampMs(createdAt) {
  if (!createdAt) return 0;
  if (createdAt.toDate) return createdAt.toDate().getTime();
  if (createdAt?.seconds != null) return createdAt.seconds * 1000;
  return new Date(createdAt).getTime() || 0;
}

export async function purgeOldMessages(uid) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  try {
    const chatsSnap = await getDocs(
      query(chatsCollection, where('participants', 'array-contains', uid))
    );

    for (const chatDoc of chatsSnap.docs) {
      const chatId = chatDoc.id;
      if (chatId === GLOBAL_CHAT_ID) continue;

      const batch = writeBatch(db);
      let ops = 0;

      const msgsSnap = await getDocs(
        query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(100))
      );

      for (const msgDoc of msgsSnap.docs) {
        const msgTs = getTimestampMs(msgDoc.data().createdAt);
        if (msgTs > 0 && msgTs < cutoff) {
          batch.delete(doc(db, 'chats', chatId, 'messages', msgDoc.id));
          ops++;
          if (ops >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            ops = 0;
          }
        }
      }

      if (ops > 0) await batch.commit();
    }
  } catch {
    // Purge is best-effort
  }
}

export const chatIdFromUsers = (uidA, uidB) => [uidA, uidB].sort().join('__');

async function ensureZolbotChat(chatId, senderId, senderEmail, senderUsername, senderPhotoURL) {
  try {
    const existingChat = await getDoc(doc(db, 'chats', chatId));
    if (existingChat.exists()) return;
  } catch {
    // getDoc may fail for non-existent docs if rules reference resource.data
  }
  await setDoc(doc(db, 'chats', chatId), {
    id: chatId,
    participants: [senderId, 'zolbot'],
    participantMeta: {
      [senderId]: {
        email: senderEmail,
        username: senderUsername,
        photoURL: senderPhotoURL || '',
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
    // Prefix search instead of downloading user docs for client-side matching.
    const end = normalized + '\uf8ff';
    const [nameSnap, emailSnap] = await Promise.all([
      getDocs(query(usersRef, where('usernameLower', '>=', normalized), where('usernameLower', '<=', end), limit(10))),
      getDocs(query(usersRef, where('email', '>=', normalized), where('email', '<=', end), limit(10))),
    ]);
    [nameSnap, emailSnap].forEach((snap) => {
      snap.forEach((docSnap) => {
        const user = docSnap.data();
        if (user.uid !== currentUid) {
          map.set(user.uid, user);
        }
      });
    });
  }

  return [...map.values()];
}

export async function startOrOpenChat(currentUser, targetUser) {
  const chatId = chatIdFromUsers(currentUser.uid, targetUser.uid);
  const chatRef = doc(db, 'chats', chatId);

  try {
    const existing = await getDoc(chatRef);
    if (existing.exists()) return chatId;
  } catch {
    // getDoc may fail for non-existent docs if rules reference resource.data
  }

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
  return chatId;
}

export async function createGroupChat({ groupName, participants, creator, groupImage }) {
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
    groupImage: groupImage || '',
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
  if (chatId === GLOBAL_CHAT_ID) return;
  const msgsRef = collection(db, 'chats', chatId, 'messages');
  const snap = await getDocs(msgsRef);
  // Firestore batches are single-use and capped at 500 ops: use a fresh
  // batch per chunk and await every commit.
  let batch = writeBatch(db);
  let count = 0;
  for (const docSnap of snap.docs) {
    batch.delete(doc(db, 'chats', chatId, 'messages', docSnap.id));
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  if (count % 500 !== 0) await batch.commit();

  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: 'Chat cleared',
    updatedAt: serverTimestamp(),
  });

  await clearCachedMessages(chatId);
}

async function requireGroupAdmin(chatId, callerUid) {
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) throw new Error('Chat not found');
  const data = snap.data();
  const admins = data.groupAdmins || [];
  // If no admins remain, any participant may manage the group (escape hatch
  // so management can never lock permanently).
  if (admins.length > 0 && !admins.includes(callerUid)) {
    throw new Error('Only group admins can do this');
  }
  return data;
}

export async function addGroupMembers(chatId, newMemberUids, callerUid) {
  const chatRef = doc(db, 'chats', chatId);
  const data = await requireGroupAdmin(chatId, callerUid);
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

export async function toggleGroupAdmin(chatId, targetUid, makeAdmin, callerUid) {
  const chatRef = doc(db, 'chats', chatId);
  const data = await requireGroupAdmin(chatId, callerUid);
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
    // No auto-promotion: if no admins remain, any participant may manage
    // the group (matches the Firestore rules escape hatch).
    await updateDoc(chatRef, {
      participants,
      groupAdmins,
      updatedAt: serverTimestamp(),
    });
  }
}

export function subscribeToChats(uid, onData) {
  let snapshotReceived = false;

  getCachedChats().then((cached) => {
    if (!snapshotReceived && cached.length > 0) onData(cached);
  });

  const chatQuery = query(chatsCollection, where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'));
  return onSnapshot(chatQuery, (snapshot) => {
    snapshotReceived = true;
    const chats = snapshot.docs.map((chatDoc) => ({ id: chatDoc.id, ...chatDoc.data() }));
    onData(chats);
    cacheChats(chats).catch(() => {});
  }, () => {
    if (!snapshotReceived) {
      getCachedChats().then((cached) => onData(cached));
    }
  });
}

export function subscribeToMessages(chatId, onData) {
  let snapshotReceived = false;

  getCachedMessages(chatId).then((cached) => {
    if (!snapshotReceived && cached.length > 0) onData(cached);
  });

  // Bound the query so large rooms (especially global) stay fast: fetch the
  // most recent N messages (desc + limit) then flip to ascending for display.
  // Unbounded orderBy('createdAt','asc') downloads the entire history on
  // every snapshot, which is what made global chat slow.
  const messageLimit = chatId === GLOBAL_CHAT_ID ? 150 : 300;
  const messageQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(messageLimit)
  );
  return onSnapshot(messageQuery, (snapshot) => {
    snapshotReceived = true;
    let docs = snapshot.docs.map((messageDoc) => ({
      id: messageDoc.id,
      ...messageDoc.data({ serverTimestamps: 'estimate' }),
    }));
    // Query was desc for speed; restore chronological order.
    docs.reverse();
    if (chatId === GLOBAL_CHAT_ID) {
      const cutoff = Date.now() - 72 * 60 * 60 * 1000;
      docs = docs.filter((msg) => {
        const ts = getTimestampMs(msg.createdAt);
        return !ts || ts >= cutoff;
      });
      purgeOldGlobalMessages().catch(() => {});
    }
    cacheMessages(chatId, docs).catch(() => {});
    onData(docs);
  }, () => {
    if (!snapshotReceived) {
      getCachedMessages(chatId).then((cached) => onData(cached));
    }
  });
}

export async function markChatAsRead(chatId, uid) {
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`participantMeta.${uid}.lastRead`]: serverTimestamp(),
    });
  } catch {
    // Chat may not exist yet
  }
}

export async function toggleMessageReaction(chatId, messageId, uid, emoji) {
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  await runTransaction(db, async (txn) => {
    const snap = await txn.get(msgRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const reactions = { ...(data.reactions || {}) };

    if (reactions[uid] === emoji) {
      delete reactions[uid];
    } else {
      reactions[uid] = emoji;
    }

    txn.update(msgRef, { reactions });
  });
}

function toMs(ts) {
  if (!ts) return 0;
  try {
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      const ms = d instanceof Date ? d.getTime() : new Date(d).getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof ts.seconds === 'number') return ts.seconds * 1000;
    if (typeof ts === 'number') return ts;
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

export async function getUnreadCounts(uid, chats) {
  const counts = {};
  await Promise.all(
    chats.map(async (chat) => {
      try {
        // No messages yet -> never unread (also skips a Firestore read).
        if (!chat.lastMessage) {
          counts[chat.id] = 0;
          return;
        }
        const lastReadMs = toMs(chat.participantMeta?.[uid]?.lastRead);
        // Global room has no membership (participants = []), so a fresh user
        // has no lastRead — counting the whole room as unread is misleading.
        // Show 0 until they've opened it at least once (which writes lastRead).
        if ((chat.isGlobal || chat.id === GLOBAL_CHAT_ID) && !lastReadMs) {
          counts[chat.id] = 0;
          return;
        }
        // Fast path: chat preview already older than last read -> nothing new.
        // Saves a Firestore read per chat and avoids stale-snapshot races where
        // updatedAt hasn't caught up yet.
        const updatedMs = toMs(chat.updatedAt);
        if (lastReadMs && updatedMs && updatedMs <= lastReadMs) {
          counts[chat.id] = 0;
          return;
        }
        // If the latest message is our own and nothing newer exists, unread is 0.
        if (chat.lastMessageSenderId === uid && lastReadMs && updatedMs && updatedMs <= lastReadMs + 1000) {
          counts[chat.id] = 0;
          return;
        }
        const messagesSnap = await getDocs(
          query(
            collection(db, 'chats', chat.id, 'messages'),
            orderBy('createdAt', 'desc'),
            limit(100),
          )
        );
        let count = 0;
        if (!lastReadMs) {
          messagesSnap.forEach((docSnap) => {
            if (docSnap.data().senderId !== uid) count++;
          });
        } else {
          messagesSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.senderId !== uid && toMs(data.createdAt) > lastReadMs) count++;
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

export async function sendMessage(chatId, sender, text, replyTo) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';
  const senderPhotoURL = sender?.photoURL || '';

  if (chatId.startsWith('zolbot__')) {
    await ensureZolbotChat(chatId, senderId, senderEmail, senderUsername, sender?.photoURL);
  }

  const messagePayload = {
    text: trimmed,
    senderId: senderId,
    senderEmail: senderEmail,
    senderUsername: senderUsername,
    senderPhotoURL: senderPhotoURL,
    status: 'sent',
    replyTo: replyTo || null,
    createdAt: serverTimestamp(),
  };
  const chatPreviewUpdate = {
    lastMessage: trimmed,
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
  };

  // Write message + preview in parallel so sends feel instant. The preview
  // update is best-effort (global chat may not exist yet for a fresh user).
  await addDoc(collection(db, 'chats', chatId, 'messages'), messagePayload);
  updateDoc(doc(db, 'chats', chatId), chatPreviewUpdate).catch(() => {});

  // Fire-and-forget push to other participants (never blocks the send).
  try {
    const { notifyChatParticipants } = await import('./notificationService');
    notifyChatParticipants(chatId, { uid: senderId, username: senderUsername }, trimmed).catch(() => {});
  } catch {}

  if (senderId === 'zolbot') return;

  if (chatId.startsWith('zolbot__')) {
    // Don't await: bot reply arrives via snapshot while the user's message
    // is already on screen.
    respondWithBot(chatId, { uid: senderId, email: senderEmail, username: senderUsername }).catch(() => {});
    return;
  }

  // Zolbot answers whenever it is tagged in a group or the global room —
  // no membership gate. Previously the bot only replied if 'zolbot' was in
  // participants, but there was no way to add it, so tags never worked.
  if (/@zolbot\b/i.test(trimmed)) {
    const isGroupLike = chatId === GLOBAL_CHAT_ID || chatId.startsWith('group_');
    if (isGroupLike) {
      respondWithBot(chatId, { uid: senderId, email: senderEmail, username: senderUsername }).catch(() => {});
    } else {
      // Fallback for groups whose id doesn't use the group_ prefix:
      // check the chat doc once (cached path, fire-and-forget).
      getDoc(doc(db, 'chats', chatId)).then((snap) => {
        const data = snap.exists() ? snap.data() : null;
        if (data?.isGroup || data?.isGlobal) {
          respondWithBot(chatId, { uid: senderId, email: senderEmail, username: senderUsername }).catch(() => {});
        }
      }).catch(() => {});
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
- Tap any image in a chat to open it in a fullscreen lightbox viewer with a close button.
- Emoji picker: tap the smiley icon to browse and insert emojis into your message.
- Links in messages are tappable and open in your browser.
- Messages show timestamps with read receipts: S (Sent) or R (Read) shown beside the time on your own messages.
- Typing indicators: when the other person is typing, you see "typing..." under their name in the header.
- Online status: a green dot appears next to users who are currently online.
- Unread badges on the chat list show how many unread messages you have per chat.
- Pull down on the chat list to refresh.

== MESSAGE ACTIONS ==
- Long-press any message to open the quick reaction and actions popover.
- React to messages with ❤️ 👍 😂 😮 😢 🔥 🚀 — reaction pills appear below the message with counts. Tap a reaction to toggle it.
- Copy text, Forward, or Delete (own messages only) from the actions menu.
- Tap "Select Messages" in the popover to enter multi-select mode — then use the header actions to batch copy, forward, or delete.
- In-chat search: tap the magnify (search) icon in the chat header to search within the conversation. Matching messages are highlighted, with Previous/Next navigation.

== PROFILE DETAILS ==
- Tap the header title or avatar in any chat to open the profile details sheet — shows full-size avatar, username, email, online status (1-on-1 chats), or group members list.

== EMPTY CHAT WELCOME ==
- When a chat has no messages yet, you'll see a welcome card with the person's name and quick starter chips like "Hey there! 👋" — tap any chip to send it instantly.

== GROUP CHATS ==
- Create group chats: tap the FAB (+ button) on the Chats screen, then tap the group icon.
- Name your group and select members from your existing contacts.
- Group chats show all members in the header (tap to see the full member list).
- Admins can add new members and manage admin roles.
- Leave a group anytime from the 3-dot menu.

== FAB SPEED DIAL ==
- On the Chats screen, tap the purple + FAB to open the speed dial with two options:
  - Search (magnify icon): search for users by email or username to start a 1-on-1 chat.
  - New Group (people icon): create a new group chat.

== CHAT MENU ==
- Tap the 3-dot menu in the chat header for options: Clear Chat (deletes all messages), and for groups: View Members, Add Members, and Leave Group.

== ZOLBOT (YOU!) ==
- Zolbot is a special AI chat, always pinned at the top of the chat list.
- You have a 5-second cooldown between messages to prevent spam.
- You are always available — every user has a Zolbot chat automatically.
- You can also be added to group chats as a member.
- If you encounter an error, you report it honestly.

== PROFILE & SETTINGS ==
- Navigate to the Settings tab to update your profile.
- Change your display username (shown in chats and to other users).
- Upload or change your profile photo (via camera/gallery picker, stored on Cloudinary).
- Toggle Dark Mode on/off with the switch — the app supports both dark and light themes.
- Adjust Font Size: choose S (Small), M (Medium), L (Large), or XL (Extra Large) to scale all text in the app.
- Log Out button to sign out.

== FINDING USERS ==
- Tap the purple Floating Action Button (+) on the Chats screen to open the speed dial.
- Search for users by their email address or username.
- Tap a search result to start a new chat with that person.

== GLOBAL CHAT ==
- Global Chat is a public room where every user can send messages.
- It appears at the top of your chat list with a 🌍 globe icon and green name.
- Anyone in the app can read and send messages here — no invite needed.
- Messages automatically delete after 72 hours.
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
    const model = process.env.EXPO_PUBLIC_GROQ_MODEL || 'openai/gpt-oss-20b';
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
        model: model,
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
      lastMessageSenderId: 'zolbot',
      updatedAt: serverTimestamp(),
    });

  } catch (err) {
    // Never leak raw API error text into the chat - log it, show a generic note.
    console.warn('[Zolbot] reply failed:', err?.message || err);
    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text: "Sorry, I'm having trouble right now. Please try again later.",
      senderId: 'zolbot',
      senderEmail: 'zolbot@zoldyck.ai',
      senderUsername: 'Zolbot',
      createdAt: serverTimestamp(),
    });
  }
}

export async function deleteMessage(chatId, messageId, uid) {
  if (uid) {
    const snap = await getDoc(doc(db, 'chats', chatId, 'messages', messageId));
    if (snap.exists() && snap.data().senderId !== uid) {
      throw new Error('You can only delete your own messages');
    }
  }
  await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
  const cached = await getCachedMessages(chatId);
  if (cached.length > 0) {
    await cacheMessages(chatId, cached.filter((m) => m.id !== messageId));
  }
  await refreshLastMessage(chatId);
}

export async function editMessage(chatId, messageId, uid, newText) {
  const trimmed = (newText || '').trim();
  if (!trimmed) throw new Error('Message cannot be empty');
  const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) throw new Error('Message not found');
  if (snap.data().senderId !== uid) throw new Error('You can only edit your own messages');
  await updateDoc(msgRef, { text: trimmed.slice(0, 2000), edited: true });
  await refreshLastMessage(chatId);
}

/**
 * Recomputes a chat's list preview from its latest remaining message.
 * Used after edits/deletes so the preview never points at stale content.
 */
export async function refreshLastMessage(chatId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(1))
    );
    const latest = snap.docs.length > 0 ? snap.docs[0].data() : null;
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: latest ? (latest.text || (latest.imageUrl ? '📷 Photo' : '')) : '',
      lastMessageSenderId: latest?.senderId || '',
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Preview refresh is best-effort
  }
}

export async function deleteChat(chatId) {
  await clearChatMessages(chatId);
  await deleteDoc(doc(db, 'chats', chatId));
  await clearCachedMessages(chatId);
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
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
  });
}

export async function sendImageMessage(chatId, sender, imageUrl, replyTo) {
  const senderId = sender?.uid || 'user';
  const senderEmail = sender?.email || '';
  const senderUsername = sender?.username || sender?.displayName || senderEmail || 'User';
  const senderPhotoURL = sender?.photoURL || '';

  if (chatId.startsWith('zolbot__')) {
    await ensureZolbotChat(chatId, senderId, senderEmail, senderUsername, sender?.photoURL);
  }

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    text: '',
    imageUrl,
    senderId,
    senderEmail,
    senderUsername,
    senderPhotoURL,
    status: 'sent',
    replyTo: replyTo || null,
    createdAt: serverTimestamp(),
  });

  updateDoc(doc(db, 'chats', chatId), {
    lastMessage: '📷 Photo',
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  try {
    const { notifyChatParticipants } = await import('./notificationService');
    notifyChatParticipants(chatId, { uid: senderId, username: senderUsername }, '📷 Photo').catch(() => {});
  } catch {}
}

export function setTyping(chatId, uid, isTyping) {
  const presenceRef = doc(db, 'chats', chatId, 'presence', uid);
  return setDoc(presenceRef, {
    uid,
    typing: isTyping,
    lastActive: new Date(),
  }, { merge: true });
}

export function setUserOnline(uid) {
  if (!uid) return Promise.resolve();
  return setDoc(doc(db, 'users', uid), {
    online: true,
    lastSeen: new Date(),
  }, { merge: true });
}

export function setUserOffline(uid) {
  if (!uid) return Promise.resolve();
  return setDoc(doc(db, 'users', uid), {
    online: false,
    lastSeen: new Date(),
  }, { merge: true });
}

export function subscribeToUsersPresence(uids, onPresenceChange) {
  if (!uids || uids.length === 0) {
    onPresenceChange({});
    return () => {};
  }
  const uidsSet = new Set(uids);
  const presenceMap = {};

  const unsubs = [];
  const chunkSize = 10;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const chunk = uids.slice(i, i + chunkSize);
    const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
    const unsub = onSnapshot(q, (snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const lastSeenMs = data.lastSeen?.toDate?.()?.getTime?.() || 0;
        const isOnline = data.online === true && lastSeenMs > 0 && (Date.now() - lastSeenMs < 120000);
        presenceMap[docSnap.id] = { online: isOnline, lastSeen: data.lastSeen };
      });
      onPresenceChange({ ...presenceMap });
    }, () => {});
    unsubs.push(unsub);
  }
  return () => unsubs.forEach((u) => u());
}

/**
 * Live-resolves user profiles (username + photoURL) from the users collection
 * (the single source of truth). Names and avatars displayed anywhere should
 * prefer this over the denormalized snapshots stored in participantMeta /
 * messages.
 */
export function subscribeToUserProfiles(uids, onProfilesChange) {
  if (!uids || uids.length === 0) {
    onProfilesChange({});
    return () => {};
  }
  const unique = [...new Set(uids.filter((u) => u && u !== 'zolbot'))];
  if (unique.length === 0) {
    onProfilesChange({});
    return () => {};
  }
  const profilesMap = {};
  const emit = () => onProfilesChange({ ...profilesMap });

  const unsubs = [];
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
    const unsub = onSnapshot(q, (snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        profilesMap[docSnap.id] = {
          username: data.username || '',
          photoURL: data.photoURL || '',
        };
      });
      emit();
    }, () => {});
    unsubs.push(unsub);
  }
  return () => unsubs.forEach((u) => u());
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


