import AsyncStorage from '@react-native-async-storage/async-storage';

const CHATS_CACHE_KEY = 'zol_chats_cache';

function serializeTimestamp(ts) {
  if (!ts) return null;
  if (typeof ts === 'object') {
    if (ts.toDate) return ts.toDate().getTime();
    if (ts.seconds != null) return ts.seconds * 1000;
  }
  if (typeof ts === 'number') return ts;
  return null;
}

export async function cacheChats(chats) {
  try {
    const serializable = chats.map((chat) => ({
      id: chat.id,
      participants: chat.participants || [],
      participantMeta: chat.participantMeta || {},
      lastMessage: chat.lastMessage || '',
      lastSenderId: chat.lastSenderId || '',
      updatedAt: serializeTimestamp(chat.updatedAt) || Date.now(),
      isGroup: chat.isGroup || false,
      groupName: chat.groupName || '',
      groupImage: chat.groupImage || '',
      groupMembers: chat.groupMembers || [],
      admins: chat.admins || [],
      isGlobal: chat.isGlobal || false,
    }));
    await AsyncStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(serializable));
  } catch {
    // Best-effort
  }
}

export async function getCachedChats() {
  try {
    const data = await AsyncStorage.getItem(CHATS_CACHE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.map((chat) => ({
      ...chat,
      updatedAt: chat.updatedAt ? { toDate: () => new Date(chat.updatedAt) } : null,
    }));
  } catch {
    return [];
  }
}
