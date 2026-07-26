import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Checkbox, FAB, IconButton, List, Portal, Searchbar, Surface, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOnline } from '../context/OnlineContext';
import { useUnread } from '../context/UnreadContext';
import { findUsersByEmailOrUsername, getUnreadCounts, startOrOpenChat, subscribeToChats, deleteChat, GLOBAL_CHAT_ID, ensureGlobalChatExists, createGroupChat } from '../services/chatService';
import { showAlert } from '../components/AppAlert';

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
  const { colors, scaleFont } = useTheme();
  const { isOnline } = useOnline();
  const { updateTotal } = useUnread();
  const styles = useMemo(() => createStyles(colors, scaleFont), [colors, scaleFont]);
  const [chats, setChats] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedGroupUids, setSelectedGroupUids] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const speedDialAnim = useRef(new Animated.Value(0)).current;

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [chatFilter, setChatFilter] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const insets = useSafeAreaInsets();

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
    ensureGlobalChatExists().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.uid || !chats.length) return;
    getUnreadCounts(user.uid, chats).then((counts) => {
      setUnreadCounts(counts);
      updateTotal(counts);
    }).catch(() => {});
  }, [user?.uid, chats, updateTotal]);

  const toggleSpeedDial = () => {
    if (speedDialOpen) {
      Animated.timing(speedDialAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => setSpeedDialOpen(false));
    } else {
      setSpeedDialOpen(true);
      Animated.spring(speedDialAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    }
  };

  const closeSpeedDial = () => {
    if (speedDialOpen) {
      Animated.timing(speedDialAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setSpeedDialOpen(false));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getUnreadCounts(user.uid, chats).then((counts) => {
      setUnreadCounts(counts);
      updateTotal(counts);
    }).catch(() => {}).finally(() => setRefreshing(false));
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
    try {
      const chatId = await startOrOpenChat(profile, target);
      setShowComposer(false);
      setSearchTerm('');
      setResults([]);
      navigation.navigate('ChatRoom', { chatId, target });
    } catch (err) {
      showAlert('Error', err?.message || 'Could not start chat. Please try again.', [{ text: 'OK' }]);
    }
  };

  const closeComposer = () => {
    setShowComposer(false);
    setSearchTerm('');
    setResults([]);
  };

  const onDeleteChat = (chat) => {
    const chatTitle = chat.isGroup
      ? (chat.groupName || 'this group')
      : (chat.partner?.username || chat.partner?.email || 'this chat');
    showAlert(
      'Delete chat',
      `Delete ${chatTitle}? All chat data will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChat(chat.id);
            } catch {
              showAlert('Error', 'Failed to delete chat.', [{ text: 'OK' }]);
            }
          },
        },
      ],
    );
  };

  const items = useMemo(() => {
    const chatItems = chats.map((chat) => {
      if (chat.isGroup) {
        return {
          ...chat,
          isGroup: true,
          partner: {
            uid: chat.id,
            username: chat.groupName || 'Group Chat',
            email: `${chat.participants?.length || 0} members`,
            isGroup: true,
            groupName: chat.groupName,
            groupAdmins: chat.groupAdmins || [],
            participants: chat.participants || [],
            participantMeta: chat.participantMeta || {},
          },
        };
      }
      const partnerId = chat.participants?.find((pId) => pId !== user?.uid);
      const partner = { uid: partnerId, ...(chat.participantMeta?.[partnerId] || {}) };
      return {
        ...chat,
        partner,
      };
    });

    const globalChat = {
      id: GLOBAL_CHAT_ID,
      participants: [user?.uid || ''],
      partner: {
        uid: GLOBAL_CHAT_ID,
        username: 'Global Chat',
        email: 'everyone@zolchat.app',
        photoURL: '',
        isGlobal: true,
      },
      lastMessage: 'Welcome to Global Chat! Say hello 👋',
      updatedAt: new Date(Date.now() - 86400000 * 2),
    };

    const zolbotId = `zolbot__${user?.uid}`;
    const hasZolbot = chatItems.some((item) => item.id === zolbotId);
    if (!hasZolbot && user?.uid) {
      chatItems.unshift({
        id: zolbotId,
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

    chatItems.unshift(globalChat);

    return chatItems;
  }, [chats, user?.uid]);

  const availableGroupContacts = useMemo(() => {
    const contactsMap = new Map();
    // Zolbot is addable to group!
    contactsMap.set('zolbot', {
      uid: 'zolbot',
      username: 'Zolbot 🤖',
      email: 'zolbot@zoldyck.ai',
      isBot: true,
    });

    items.forEach((item) => {
      if (!item.isGroup && !item.partner.isGlobal && item.partner.uid !== user?.uid) {
        contactsMap.set(item.partner.uid, {
          uid: item.partner.uid,
          username: item.partner.username || item.partner.email || 'User',
          email: item.partner.email || '',
          photoURL: item.partner.photoURL || '',
        });
      }
    });

    return Array.from(contactsMap.values());
  }, [items, user?.uid]);

  const toggleSelectParticipant = (uid) => {
    setSelectedGroupUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupNameInput.trim()) {
      showAlert('Validation', 'Please enter a group name.', [{ text: 'OK' }]);
      return;
    }
    if (selectedGroupUids.length === 0) {
      showAlert('Validation', 'Please select at least 1 member for the group.', [{ text: 'OK' }]);
      return;
    }

    setCreatingGroup(true);
    try {
      const newGroupId = await createGroupChat({
        groupName: groupNameInput.trim(),
        participants: selectedGroupUids,
        creator: profile || user,
      });

      setShowCreateGroup(false);
      setGroupNameInput('');
      setSelectedGroupUids([]);

      navigation.navigate('ChatRoom', {
        chatId: newGroupId,
        target: {
          uid: newGroupId,
          isGroup: true,
          groupName: groupNameInput.trim(),
          participants: [user.uid, ...selectedGroupUids],
        },
      });
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to create group chat.', [{ text: 'OK' }]);
    } finally {
      setCreatingGroup(false);
    }
  };

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
      <View style={[styles.searchBarContainer, { paddingTop: insets.top + 8 }]}>
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
              titleStyle={[
                styles.chatTitle,
                item.partner.uid === 'zolbot' && styles.zolbotTitle,
                item.partner.isGlobal && styles.globalTitle,
                item.isGroup && { color: colors.secondary, fontWeight: '700' },
              ]}
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
                    ) : item.partner.isGlobal ? (
                      <Avatar.Text
                        size={48}
                        label="🌍"
                        style={[styles.avatarTextBg, { backgroundColor: colors.primary + '30' }]}
                        labelStyle={{ fontSize: 24 }}
                      />
                    ) : item.isGroup ? (
                      <Avatar.Text
                        size={48}
                        label={item.partner.username ? item.partner.username.slice(0, 2).toUpperCase() : 'GP'}
                        style={[styles.avatarTextBg, { backgroundColor: colors.secondary + '30' }]}
                        labelStyle={{ color: colors.secondary, fontWeight: 'bold' }}
                      />
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
                    {!item.isGroup && item.partner.uid !== 'zolbot' && !item.partner.isGlobal && isOnline(item.partner.uid) && (
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
        {/* 1-on-1 User Search Sheet */}
        {showComposer && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={closeComposer} />
            <Surface style={styles.searchSheet} elevation={4}>
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

        {/* Group Creation Sheet */}
        {showCreateGroup && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={() => setShowCreateGroup(false)} />
            <Surface style={[styles.composer, { maxHeight: '85%' }]} elevation={4}>
              <Text variant="titleMedium" style={styles.composerTitle}>Create Group Chat</Text>
              <TextInput
                label="Group Name"
                value={groupNameInput}
                onChangeText={setGroupNameInput}
                mode="outlined"
                style={{ backgroundColor: colors.background }}
                activeOutlineColor={colors.primary}
                outlineColor={colors.surfaceVariant}
                textColor={colors.onSurface}
              />
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Select members to add:</Text>
              <FlatList
                data={availableGroupContacts}
                keyExtractor={(item) => item.uid}
                style={{ maxHeight: 220, marginTop: 4 }}
                renderItem={({ item }) => {
                  const selected = selectedGroupUids.includes(item.uid);
                  return (
                    <Pressable
                      style={[
                        styles.contactSelectItem,
                        selected && { backgroundColor: colors.primary + '20' },
                      ]}
                      onPress={() => toggleSelectParticipant(item.uid)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        {item.uid === 'zolbot' ? (
                          <Avatar.Image source={require('../../assets/zolbot.jpg')} size={36} />
                        ) : item.photoURL ? (
                          <Avatar.Image source={{ uri: item.photoURL }} size={36} />
                        ) : (
                          <Avatar.Text
                            size={36}
                            label={(item.username || '?').slice(0, 2).toUpperCase()}
                            style={styles.avatarTextBg}
                            labelStyle={{ fontSize: 14, color: colors.primary }}
                          />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 14 }}>{item.username}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{item.email}</Text>
                        </View>
                      </View>
                      <Checkbox.Android
                        status={selected ? 'checked' : 'unchecked'}
                        color={colors.primary}
                        onPress={() => toggleSelectParticipant(item.uid)}
                      />
                    </Pressable>
                  );
                }}
              />
              <Button
                mode="contained"
                onPress={handleCreateGroup}
                loading={creatingGroup}
                disabled={creatingGroup || !groupNameInput.trim() || selectedGroupUids.length === 0}
                style={{ borderRadius: 12, marginTop: 8, backgroundColor: colors.primary }}
                labelStyle={{ fontWeight: '700', paddingVertical: 2 }}
              >
                Create Group ({selectedGroupUids.length})
              </Button>
              <FAB 
                icon="close" 
                style={styles.closeFab} 
                onPress={() => setShowCreateGroup(false)} 
                size="small" 
                color={colors.onSurface}
              />
            </Surface>
          </KeyboardAvoidingView>
        )}
      </Portal>

      {/* Speed Dial Backdrop & Action Buttons */}
      {speedDialOpen && (
        <Pressable style={styles.speedDialBackdrop} onPress={closeSpeedDial}>
          {/* Action Button 2: Group Icon */}
          <Animated.View
            style={[
              styles.speedDialActionItem,
              {
                bottom: Math.max(insets.bottom + 16, 20) + 140,
                opacity: speedDialAnim,
                transform: [
                  {
                    translateY: speedDialAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [40, 0],
                    }),
                  },
                  {
                    scale: speedDialAnim,
                  },
                ],
              },
            ]}
          >
            <View style={styles.speedDialLabelBadge}>
              <Text style={styles.speedDialLabelText}>New Group</Text>
            </View>
            <FAB
              icon="account-group"
              size="medium"
              style={[styles.actionFab, { backgroundColor: colors.secondary }]}
              color="#000000"
              onPress={() => {
                closeSpeedDial();
                setShowCreateGroup(true);
              }}
            />
          </Animated.View>

          {/* Action Button 1: Search Icon */}
          <Animated.View
            style={[
              styles.speedDialActionItem,
              {
                bottom: Math.max(insets.bottom + 16, 20) + 75,
                opacity: speedDialAnim,
                transform: [
                  {
                    translateY: speedDialAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                  {
                    scale: speedDialAnim,
                  },
                ],
              },
            ]}
          >
            <View style={styles.speedDialLabelBadge}>
              <Text style={styles.speedDialLabelText}>Search Chat</Text>
            </View>
            <FAB
              icon="magnify"
              size="medium"
              style={[styles.actionFab, { backgroundColor: colors.primary }]}
              color="#000000"
              onPress={() => {
                closeSpeedDial();
                setShowComposer(true);
              }}
            />
          </Animated.View>
        </Pressable>
      )}

      {/* Main Bottom-Right FAB + Button */}
      <FAB 
        icon="plus" 
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 16, 20) },
          speedDialOpen && { backgroundColor: colors.surfaceVariant },
        ]} 
        color={speedDialOpen ? colors.onSurface : colors.background} 
        onPress={toggleSpeedDial} 
        accessibilityLabel="Open options"
      />
    </View>
  );
}

const createStyles = (c, sf) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  listContainer: {
    paddingVertical: 8,
  },
  chatItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: c.surface,
    paddingVertical: 4,
  },
  chatTitle: {
    color: c.onSurface,
    fontWeight: '600',
    fontSize: sf(16),
  },
  zolbotTitle: {
    color: c.primary,
    fontStyle: 'italic',
  },
  globalTitle: {
    color: '#4CAF50',
    fontWeight: '800',
  },
  chatDescription: {
    color: c.muted,
    fontSize: sf(13),
    marginTop: 2,
  },
  chatTime: {
    color: c.muted,
    fontSize: sf(11),
  },
  chatRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  unreadBadge: {
    backgroundColor: c.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: c.white,
    fontSize: sf(11),
    fontWeight: '700',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chatSearch: {
    borderRadius: 14,
    backgroundColor: c.surface,
    height: 44,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 8,
    paddingLeft: 4,
  },
  avatarTextBg: {
    backgroundColor: c.surfaceVariant,
  },
  avatarLabel: {
    color: c.primary,
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
    borderColor: c.surface,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  empty: {
    textAlign: 'center',
    color: c.muted,
    fontSize: 15,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: c.primary,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    borderBottomWidth: 0,
  },
  searchSheet: {
    position: 'absolute',
    top: '15%',
    left: 16,
    right: 16,
    maxHeight: '65%',
    borderRadius: 28,
    padding: 20,
    gap: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  composerTitle: {
    color: c.onSurface,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  search: {
    borderRadius: 14,
    backgroundColor: c.background,
  },
  searchResultsList: {
    marginTop: 4,
  },
  searchItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
    paddingVertical: 2,
  },
  searchResultTitle: {
    color: c.onSurface,
    fontWeight: '600',
  },
  searchResultDesc: {
    color: c.muted,
  },
  searchAvatarContainer: {
    justifyContent: 'center',
    marginRight: 6,
  },
  emptySmall: {
    textAlign: 'center',
    marginTop: 16,
    color: c.muted,
  },
  closeFab: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: c.surfaceVariant,
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
    borderBottomColor: c.surface,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surfaceVariant,
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
    backgroundColor: c.surfaceVariant,
  },
  skeletonDesc: {
    height: 12,
    width: '70%',
    borderRadius: 4,
    backgroundColor: c.surfaceVariant,
  },
  speedDialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 99,
  },
  speedDialActionItem: {
    position: 'absolute',
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
  },
  speedDialLabelBadge: {
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
    elevation: 3,
  },
  speedDialLabelText: {
    color: c.onSurface,
    fontSize: 13,
    fontWeight: '600',
  },
  actionFab: {
    borderRadius: 24,
    elevation: 4,
  },
  contactSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
});
