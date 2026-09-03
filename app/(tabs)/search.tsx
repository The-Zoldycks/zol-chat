import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { SearchBar } from '../../components/SearchBar';
import { Avatar } from '../../components/Avatar';
import {
  findUsersByEmailOrUsername,
  startOrOpenChat,
  subscribeToChats,
  subscribeToUsersPresence,
  GLOBAL_CHAT_ID,
} from '../../src/services/chatService';

export default function SearchScreen() {
  const { user, userProfile } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { online: boolean }>>({});

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid, (chatList: any[]) => {
      const recent = chatList
        .filter((c) => !c.isGlobal && !c.id?.startsWith('zolbot__'))
        .slice(0, 10);
      setRecentChats(recent);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const allUids = new Set<string>();
    recentChats.forEach((chat) => {
      if (chat.participantMeta) {
        Object.keys(chat.participantMeta).forEach((uid) => {
          if (uid !== user.uid) allUids.add(uid);
        });
      }
    });
    searchResults.forEach((r) => { if (r.uid !== user?.uid) allUids.add(r.uid); });
    if (allUids.size === 0) return;
    const unsub = subscribeToUsersPresence([...allUids], setOnlineUsers);
    return unsub;
  }, [user, recentChats, searchResults]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await findUsersByEmailOrUsername(searchQuery, user?.uid || '');
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleStartChat = async (targetUser: any) => {
    if (!userProfile) return;

    if (targetUser.uid === 'zolbot') {
      router.push(`/chat/zolbot__${user?.uid}`);
      return;
    }

    try {
      const chatId = await startOrOpenChat(userProfile, targetUser);
      router.push(`/chat/${chatId}`);
    } catch {}
  };

  const getRecentChatName = (chat: any) => {
    if (chat.groupName) return chat.groupName;
    if (chat.participantMeta) {
      const other = Object.entries(chat.participantMeta).find(
        ([key]) => key !== user?.uid
      );
      if (other) return (other[1] as any)?.username || 'User';
    }
    return 'Chat';
  };

  const getRecentChatAvatar = (chat: any) => {
    if (chat.participantMeta) {
      const other = Object.entries(chat.participantMeta).find(
        ([key]) => key !== user?.uid
      );
      if (other) return (other[1] as any)?.photoURL || null;
    }
    return null;
  };

  const quickAccess = [
    {
      uid: 'zolbot',
      username: 'Zolbot',
      email: 'AI Assistant',
      photoURL: '',
      isBot: true,
    },
    {
      uid: 'global_chat',
      username: 'Global Chat',
      email: 'Public chat room',
      photoURL: '',
      isGlobal: true,
    },
  ];

  const recentAsUsers = recentChats.map((chat) => {
    const meta = chat.participantMeta || {};
    const entries = Object.entries(meta);
    const other = entries.find(([key]) => key !== user?.uid) as [string, any] | undefined;
    return {
      uid: other?.[0] || chat.id,
      username: getRecentChatName(chat),
      email: other?.[1]?.email || '',
      photoURL: getRecentChatAvatar(chat),
      chatId: chat.id,
      isRecent: true,
    };
  });

  const defaultList = [...quickAccess, ...recentAsUsers];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerSection}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search users by username..."
        />
      </View>

      {!searchQuery.trim() ? (
        <FlatList
          data={defaultList}
          keyExtractor={(item) => item.uid}
          ListHeaderComponent={
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {recentAsUsers.length > 0 ? 'Recent' : 'Quick Access'}
            </Text>
          }
          renderItem={({ item }) => {
            const recentItem = item as any;
            const isOnline = recentItem.uid ? onlineUsers[recentItem.uid]?.online === true : false;
            return (
              <TouchableOpacity
                style={[styles.resultItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  if (recentItem.isRecent && recentItem.chatId) {
                    router.push(`/chat/${recentItem.chatId}`);
                  } else {
                    handleStartChat(item);
                  }
                }}
              >
                {recentItem.isBot ? (
                  <View style={[styles.resultAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <MaterialIcons name="smart-toy" size={24} color={colors.primary} />
                  </View>
                ) : recentItem.isGlobal ? (
                  <View style={[styles.resultAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <MaterialIcons name="public" size={24} color={colors.primary} />
                  </View>
                ) : (
                  <View>
                    <Avatar uri={item.photoURL} size={44} />
                    {isOnline && (
                      <View style={[styles.onlineDot, { backgroundColor: '#22C55E' }]} />
                    )}
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultName, { color: colors.text }]}>
                    {item.username}
                  </Text>
                  <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                    {item.email}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultItem, { borderBottomColor: colors.border }]}
              onPress={() => handleStartChat(item)}
            >
              <View>
                <Avatar uri={item.photoURL} size={44} isBot={item.isBot} />
                {onlineUsers[item.uid]?.online === true && (
                  <View style={[styles.onlineDot, { backgroundColor: '#22C55E' }]} />
                )}
              </View>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: colors.text }]}>
                  {item.username}
                </Text>
                <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                  {item.email}
                </Text>
              </View>
              <MaterialIcons name="chat" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searching ? (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>Searching...</Text>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No users found
              </Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  resultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultSub: {
    fontSize: 13,
    marginTop: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 15,
  },
});
