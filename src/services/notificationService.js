import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    // Newer expo-notifications also reads these; harmless on older SDKs.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Tracks which chat the user is currently viewing so we don't notify for it.
let activeChatId = null;

export function setActiveChatId(chatId) {
  activeChatId = chatId || null;
}

export function getActiveChatId() {
  return activeChatId;
}

export async function registerForPushNotifications(uid) {
  // Push tokens only exist on physical devices, never on simulators or web.
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    // MAX importance => heads-up banner + sound. DEFAULT was too easy to miss.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
      enableVibrate: true,
      showBadge: true,
    });
  }

  // NOTE: this must be the EAS project ID (app.json -> extra.eas.projectId),
  // not the Firebase project ID.
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  // Store the token on the user doc so senders can target this device.
  if (uid && token?.data) {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid), { pushToken: token.data }, { merge: true }).catch(() => {});
  }

  return token?.data || null;
}

export function setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification?.request?.content?.data || {};
    // Suppress the banner when the user is already looking at that chat.
    if (data.chatId && data.chatId === activeChatId) return;
    if (onNotificationReceived) onNotificationReceived(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (onNotificationTapped) onNotificationTapped(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Shows an immediate local notification for an incoming message.
 * Used while the app is foregrounded: Firestore snapshots keep arriving,
 * so the chat list watcher calls this when a new message lands in a chat
 * the user is NOT currently viewing.
 */
export async function scheduleLocalMessageNotification({ title, body, chatId }) {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;
    if (chatId && chatId === activeChatId) return;
    const perms = await Notifications.getPermissionsAsync();
    if (perms.status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'New message',
        body: body || '',
        data: chatId ? { chatId } : {},
        sound: 'default',
      },
      trigger: null,
    });
  } catch {
    // Local notifications are best-effort
  }
}

async function sendPushToTokens(tokens, { title, body, chatId }) {
  const valid = (tokens || []).filter(
    (t) => typeof t === 'string' && t.startsWith('ExponentPushToken[')
  );
  if (valid.length === 0) return;
  const messages = valid.map((to) => ({
    to,
    sound: 'default',
    title: title || 'New message',
    body: body || '',
    data: chatId ? { chatId } : {},
  }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch {
    // Push delivery is best-effort; message itself is already saved.
  }
}

/**
 * Sender-side fan-out: after a message is saved, push-notify every other
 * participant that has a stored Expo push token. Fire-and-forget — callers
 * must not await this on the send path.
 *
 * Previously nothing ever sent pushes (tokens were stored but never used),
 * so notifications silently never arrived.
 */
export async function notifyChatParticipants(chatId, sender, text) {
  try {
    if (!chatId) return;
    // Zolbot DMs are single-user; skip sender-side push for the user's own
    // echo (the only other "participant" is the bot itself).
    if (chatId.startsWith('zolbot__')) return;
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (!chatSnap.exists()) return;
    const data = chatSnap.data();
    const participants = (data.participants || []).filter(
      (p) => p && p !== sender?.uid && p !== 'zolbot'
    );
    if (participants.length === 0) return;

    const tokenPromises = participants.slice(0, 20).map(async (uid) => {
      try {
        const uSnap = await getDoc(doc(db, 'users', uid));
        return uSnap.exists() ? uSnap.data()?.pushToken || null : null;
      } catch {
        return null;
      }
    });
    const tokens = (await Promise.all(tokenPromises)).filter(Boolean);
    if (tokens.length === 0) return;

    const senderName = sender?.username || 'Someone';
    const isGroup = data.isGroup || String(chatId).startsWith('group_');
    const isGlobal = data.isGlobal || chatId === 'global_chat';
    const title = isGroup && data.groupName
      ? `${data.groupName} • ${senderName}`
      : isGlobal
        ? `Global Chat • ${senderName}`
        : senderName;
    const body = text && text.length > 140 ? `${text.slice(0, 140)}…` : text || 'Sent you a message';
    await sendPushToTokens(tokens, { title, body, chatId });
  } catch {
    // Never throw on the send path
  }
}
