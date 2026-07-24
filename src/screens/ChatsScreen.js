import { useEffect, useMemo, useState, useCallback } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, FAB, List, Portal, Searchbar, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOnline } from '../context/OnlineContext';
import { useUnread } from '../context/UnreadContext';
import { findUsersByEmailOrUsername, getUnreadCounts, startOrOpenChat, subscribeToChats, deleteChat } from '../services/chatService';

const formatChatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    let date;
    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else if (timestamp?.seconds != null) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function ChatsScreen({ navigation }) {
  const { user, profile, isNewUser, dismissNewUser } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = useOnline();
  const { updateTotal } = useUnread();
  const [chats, setChats] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatFilter, setChatFilter] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const insets = useSafeAreaInsets();

  // Redirect new users to Settings page to finish their profile setup
  useEffect(() => {
    if (isNewUser) {
      dismissNewUser();
      navigation.navigate('Settings');
    }
  }, [isNewUser, navigation, dismissNewUser]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToChats(user.uid, (data) => {
      setChats(data);
      setLoadingChats(false);
    });
    return unsubscribe;
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !chats.length) return;
    getUnreadCounts(user.uid, chats).then((counts) => {
      setUnreadCounts(counts);
      updateTotal(counts);
    });
  }, [user?.uid, chats, updateTotal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getUnreadCounts(user.uid, chats).then((counts) => {
      setUnreadCounts(counts);
      updateTotal(counts);
      setRefreshing(false);
    });
  }, [user?.uid, chats, updateTotal]);

  const runSearch = async (value) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const found = await findUsersByEmailOrUsername(value, user.uid);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openChatWithUser = async (target) => {
    const chatId = await startOrOpenChat(profile, target);
    setShowComposer(false);
    setSearchTerm('');
    setResults([]);
    navigation.navigate('ChatRoom', { chatId, target });
  };

  const closeComposer = () => {
    setShowComposer(false);
    setSearchTerm('');
    setResults([]);
  };

  const onDeleteChat = (chat) => {
    Alert.alert(
      'Delete chat',
      `Delete your chat with ${chat.partner.username || chat.partner.email || 'this user'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chat.id);
            } catch {
              Alert.alert('Error', 'Failed to delete chat.');
            }
          },
        },
      ],
    );
  };

  const items = useMemo(() => {
    const chatItems = chats.map((chat) => {
      const partnerId = chat.participants.find((participantId) => participantId !== user?.uid);
      const partner = chat.participantMeta?.[partnerId] || {};
      return {
        ...chat,
        partner,
      };
    });

    const hasZolbot = chatItems.some((item) => item.partner.uid === 'zolbot');
    if (!hasZolbot && user?.uid) {
      chatItems.unshift({
        id: `zolbot__${user.uid}`,
        participants: [user.uid, 'zolbot'],
        partner: {
          uid: 'zolbot',
          username: 'Zolbot',
          email: 'zolbot@zoldyck.ai',
          photoURL: '',
          isBot: true,
        },
        lastMessage: 'Hi! I am Zolbot. Ask me anything! 🤖',
        updatedAt: new Date(Date.now() - 86400000),
      });
    }

    return chatItems;
  }, [chats, user?.uid]);

  const filteredItems = useMemo(() => {
    if (!chatFilter.trim()) return items;
    const term = chatFilter.toLowerCase();
    return items.filter((item) => {
      const name = (item.partner.username || item.partner.email || '').toLowerCase();
      return name.includes(term);
    });
  }, [items, chatFilter]);

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonDesc} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <Searchbar
          placeholder="Search chats..."
          value={chatFilter}
          onChangeText={setChatFilter}
          style={styles.chatSearch}
          placeholderTextColor={colors.muted}
          iconColor={colors.muted}
          textColor={colors.onSurface}
        />
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          loadingChats ? renderSkeleton() : (
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>No chats yet. Start a conversation with the + button.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.chatItemContainer}>
            <List.Item
              title={item.partner.username || item.partner.email || 'Unknown User'}
              description={item.lastMessage || 'Say hello 👋'}
              onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, target: item.partner })}
              onLongPress={() => onDeleteChat(item)}
              titleStyle={styles.chatTitle}
              descriptionStyle={styles.chatDescription}
              right={() => (
                <View style={styles.chatRight}>
                  <Text style={styles.chatTime}>{formatChatTime(item.updatedAt)}</Text>
                  {(unreadCounts[item.id] || 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{unreadCounts[item.id]}</Text>
                    </View>
                  )}
                </View>
              )}
              left={() => (
                <View style={styles.avatarContainer}>
                  <View>
                    {item.partner.uid === 'zolbot' ? (
                      <Avatar.Image source={require('../../assets/zolbot.jpg')} size={48} />
                    ) : item.partner.photoURL ? (
                      <Avatar.Image source={{ uri: item.partner.photoURL }} size={48} />
                    ) : (
                      <Avatar.Text 
                        size={48} 
                        label={(item.partner.username || item.partner.email || '?').slice(0, 2).toUpperCase()} 
                        style={styles.avatarTextBg}
                        labelStyle={styles.avatarLabel}
                      />
                    )}
                    {item.partner.uid !== 'zolbot' && isOnline(item.partner.uid) && (
                      <View style={styles.onlineDot} />
                    )}
                  </View>
                </View>
              )}
            />
          </View>
        )}
      />

      <Portal>
        {showComposer && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={closeComposer} />
            <Surface style={styles.composer} elevation={4}>
              <Text variant="titleMedium" style={styles.composerTitle}>Start new chat</Text>
              <Searchbar 
                placeholder="Search by email or username" 
                value={searchTerm} 
                onChangeText={runSearch} 
                style={styles.search} 
                placeholderTextColor={colors.muted}
                iconColor={colors.muted}
                textColor={colors.onSurface}
                loading={searching}
              />
              <FlatList
                data={results}
                keyExtractor={(item) => item.uid}
                style={styles.searchResultsList}
                ListEmptyComponent={searchTerm && !searching ? <Text style={styles.emptySmall}>No user found.</Text> : null}
                renderItem={({ item }) => (
                  <View style={styles.searchItemContainer}>
                    <List.Item
                      title={item.username || item.email}
                      description={item.email}
                      onPress={() => openChatWithUser(item)}
                      titleStyle={styles.searchResultTitle}
                      descriptionStyle={styles.searchResultDesc}
                      left={() => (
                        <View style={styles.searchAvatarContainer}>
                          {item.photoURL ? (
                            <Avatar.Image source={{ uri: item.photoURL }} size={40} />
                          ) : (
                            <Avatar.Text 
                              size={40} 
                              label={(item.username || item.email || '?').slice(0, 2).toUpperCase()} 
                              style={styles.avatarTextBg}
                              labelStyle={styles.avatarLabel}
                            />
                          )}
                        </View>
                      )}
                    />
                  </View>
                )}
              />
              <FAB 
                icon="close" 
                style={styles.closeFab} 
                onPress={closeComposer} 
                size="small" 
                color={colors.onSurface}
              />
            </Surface>
          </KeyboardAvoidingView>
        )}
      </Portal>

      <FAB 
        icon="plus" 
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 20) }]} 
        color={colors.background} 
        onPress={() => setShowComposer(true)}
        accessibilityLabel="Start new chat"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContainer: {
    paddingVertical: 8,
  },
  chatItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    paddingVertical: 4,
  },
  chatTitle: {
    color: colors.onSurface,
    fontWeight: '600',
    fontSize: 16,
  },
  chatDescription: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  chatTime: {
    color: colors.muted,
    fontSize: 11,
  },
  chatRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chatSearch: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    height: 44,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 8,
    paddingLeft: 4,
  },
  avatarTextBg: {
    backgroundColor: colors.surfaceVariant,
  },
  avatarLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 26, 0.6)',
  },
  composer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceVariant,
    borderBottomWidth: 0,
  },
  composerTitle: {
    color: colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  search: {
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  searchResultsList: {
    marginTop: 4,
  },
  searchItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
    paddingVertical: 2,
  },
  searchResultTitle: {
    color: colors.onSurface,
    fontWeight: '600',
  },
  searchResultDesc: {
    color: colors.muted,
  },
  searchAvatarContainer: {
    justifyContent: 'center',
    marginRight: 6,
  },
  emptySmall: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.muted,
  },
  closeFab: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonText: {
    marginLeft: 12,
    flex: 1,
    gap: 8,
  },
  skeletonTitle: {
    height: 14,
    width: '50%',
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
  },
  skeletonDesc: {
    height: 12,
    width: '70%',
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
  },
});
