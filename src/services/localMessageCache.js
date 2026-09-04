import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'zol_msgs_';
const MAX_CACHE_MESSAGES = 500;

function cacheKey(chatId) {
  return `${CACHE_PREFIX}${chatId}`;
}

export async function cacheMessages(chatId, messages) {
  try {
    const serializable = messages.map((m) => {
      let ts = m.createdAt;
      if (ts && typeof ts === 'object') {
        if (ts.toDate) ts = ts.toDate().getTime();
        else if (ts.seconds != null) ts = ts.seconds * 1000;
        else ts = null;
      }
      return {
        id: m.id,
        text: m.text || '',
        imageUrl: m.imageUrl || null,
        senderId: m.senderId || '',
        senderEmail: m.senderEmail || '',
        senderUsername: m.senderUsername || '',
        status: m.status || 'sent',
        reactions: m.reactions || {},
        forwarded: m.forwarded || false,
        senderProfile: m.senderProfile || null,
        createdAt: ts || Date.now(),
      };
    });
    const toStore = serializable.slice(-MAX_CACHE_MESSAGES);
    await AsyncStorage.setItem(cacheKey(chatId), JSON.stringify(toStore));
  } catch {
    // Cache write is best-effort
  }
}

export async function getCachedMessages(chatId) {
  try {
    const data = await AsyncStorage.getItem(cacheKey(chatId));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearCachedMessages(chatId) {
  try {
    await AsyncStorage.removeItem(cacheKey(chatId));
  } catch {
    // Best-effort
  }
}

export async function clearAllMessageCaches() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const msgKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (msgKeys.length > 0) {
      await AsyncStorage.multiRemove(msgKeys);
    }
  } catch {
    // Best-effort
  }
}
