import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  Text,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { ChatListItem } from '../../components/ChatListItem';
import { Avatar } from '../../components/Avatar';
import { SearchBar } from '../../components/SearchBar';
import {
  subscribeToChats,
  getUnreadCounts,
  ensureGlobalChatExists,
  findUsersByEmailOrUsername,
  startOrOpenChat,
  createGroupChat,
  GLOBAL_CHAT_ID,
  subscribeToUsersPresence,
} from '../../src/services/chatService';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/services/firebase';

export default function ChatsScreen() {
  const { user, userProfile } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [chats, setChats] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupImage, setGroupImage] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [profileSheetChat, setProfileSheetChat] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { online: boolean }>>({});

  useEffect(() => {
    if (!user) return;
    ensureGlobalChatExists().catch(() => {});

    let globalChatData: any = null;

    const unsubChats = subscribeToChats(user.uid, async (chatList: any[]) => {
      const allChats = globalChatData ? [globalChatData, ...chatList] : chatList;
      setChats(allChats);
      const counts = await getUnreadCounts(user.uid, allChats);
      setUnreadCounts(counts as Record<string, number>);
    });

    const unsubGlobal = onSnapshot(doc(db, 'chats', GLOBAL_CHAT_ID), (snap) => {
      if (snap.exists()) {
        globalChatData = { id: GLOBAL_CHAT_ID, ...snap.data() };
        setChats((prev) => {
          const without = prev.filter((c) => c.id !== GLOBAL_CHAT_ID);
          return [globalChatData, ...without];
        });
      }
    }, () => {});

    return () => {
      unsubChats();
      unsubGlobal();
    };
  }, [user]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const uids = new Set<string>();
    chats.forEach((chat) => {
      if (chat.participantMeta) {
        Object.keys(chat.participantMeta).forEach((uid) => {
          if (uid !== user.uid && uid !== 'zolbot') uids.add(uid);
        });
      }
    });
    if (uids.size === 0) return;
    const unsub = subscribeToUsersPresence([...uids], setOnlineUsers);
    return unsub;
  }, [user, chats]);

  useEffect(() => {
    if (!userSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await findUsersByEmailOrUsername(userSearch, user?.uid || '');
      setSearchResults(results);
    }, 400);
    return () => clearTimeout(timer);
  }, [userSearch]);

  useFocusEffect(
    useCallback(() => {
      if (!user || chats.length === 0) return;
      getUnreadCounts(user.uid, chats).then((counts) => {
        setUnreadCounts(counts as Record<string, number>);
      }).catch(() => {});
    }, [user, chats])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    ensureGlobalChatExists().catch(() => {});
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleStartChat = async (targetUser: any) => {
    setSearchModalVisible(false);
    setUserSearch('');
    if (!userProfile) return;

    if (targetUser.uid === 'zolbot') {
      const chatId = `zolbot__${user?.uid}`;
      router.push(`/chat/${chatId}`);
      return;
    }

    try {
      const chatId = await startOrOpenChat(userProfile, targetUser);
      router.push(`/chat/${chatId}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handlePickGroupImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setGroupImage(result.assets[0].uri);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !userProfile) return;
    setCreatingGroup(true);
    try {
      let imageUrl = '';
      if (groupImage) {
        imageUrl = await uploadToCloudinary(groupImage);
      }
      const groupId = await createGroupChat({
        groupName: groupName.trim(),
        participants: selectedMembers,
        creator: { ...userProfile, photoURL: imageUrl || userProfile.photoURL },
      });
      setGroupModalVisible(false);
      setGroupName('');
      setSelectedMembers([]);
      setGroupImage(null);
      router.push(`/chat/${groupId}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setCreatingGroup(false);
    }
  };

  const getChatDisplayName = (chat: any) => {
    if (!chat) return 'Chat';
    if (chat.isGlobal) return 'Global Chat';
    if (chat.id?.startsWith('zolbot__')) return 'Zolbot';
    if (chat.groupName) return chat.groupName;
    if (chat.participantMeta) {
      const other = Object.entries(chat.participantMeta).find(
        ([key]) => key !== user?.uid && key !== 'zolbot'
      );
      if (other) return (other[1] as any)?.username || 'User';
    }
    return 'Chat';
  };

  const getChatAvatar = (chat: any) => {
    if (!chat) return null;
    if (chat.id?.startsWith('zolbot__')) return null;
    if (chat.participantMeta) {
      const other = Object.entries(chat.participantMeta).find(
        ([key]) => key !== user?.uid && key !== 'zolbot'
      );
      if (other) return (other[1] as any)?.photoURL || null;
    }
    return null;
  };

  const formatTimestamp = (updatedAt: any) => {
    if (!updatedAt) return '';
    let date: Date;
    if (updatedAt.toDate) date = updatedAt.toDate();
    else if (updatedAt.seconds) date = new Date(updatedAt.seconds * 1000);
    else date = new Date(updatedAt);

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredChats = chats.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const name = getChatDisplayName(chat).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.headerSection}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search chats..."
        />
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={({ item }) => (
          <ChatListItem
            name={getChatDisplayName(item)}
            lastMessage={item.lastMessage || ''}
            timestamp={formatTimestamp(item.updatedAt)}
            unreadCount={unreadCounts[item.id] || 0}
            avatarUri={getChatAvatar(item)}
            isBot={item.id?.startsWith('zolbot__')}
            isGlobal={item.isGlobal}
            isGroup={item.isGroup}
            isOnline={(() => {
              if (item.isGlobal || item.isGroup || item.id?.startsWith('zolbot__')) return false;
              const otherUid = Object.keys(item.participantMeta || {}).find((k) => k !== user?.uid);
              return otherUid ? onlineUsers[otherUid]?.online === true : false;
            })()}
            onPress={() => router.push(`/chat/${item.id}`)}
            onNamePress={() => setProfileSheetChat(item)}
            onAvatarPress={() => {
              if (item.isGlobal || item.isGroup || item.id?.startsWith('zolbot__')) {
                setProfileSheetChat(item);
              } else {
                setProfileSheetChat(item);
              }
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="chat-bubble-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No chats yet. Start a conversation!
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.fab }]}
        onPress={() => setFabOpen(!fabOpen)}
        activeOpacity={0.8}
      >
        <MaterialIcons name={fabOpen ? 'close' : 'add'} size={28} color={colors.fabText} />
      </TouchableOpacity>

      {/* FAB Menu */}
      {fabOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={[styles.fabMenuItem, { backgroundColor: colors.surface }]}
            onPress={() => {
              setFabOpen(false);
              setSearchModalVisible(true);
            }}
          >
            <MaterialIcons name="search" size={22} color={colors.primary} />
            <Text style={[styles.fabMenuText, { color: colors.text }]}>New Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fabMenuItem, { backgroundColor: colors.surface }]}
            onPress={() => {
              setFabOpen(false);
              setGroupModalVisible(true);
            }}
          >
            <MaterialIcons name="group-add" size={22} color={colors.primary} />
            <Text style={[styles.fabMenuText, { color: colors.text }]}>New Group</Text>
          </TouchableOpacity>
        </View>
      )}

      {fabOpen && (
        <TouchableOpacity
          style={[styles.fabBackdrop, { backgroundColor: 'transparent' }]}
          onPress={() => setFabOpen(false)}
          activeOpacity={1}
        />
      )}

      {/* Search Users Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Find Users</Text>
              <TouchableOpacity onPress={() => { setSearchModalVisible(false); setSearchResults([]); setUserSearch(''); }}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <SearchBar
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search by username or email..."
            />
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResult, { borderBottomColor: colors.border }]}
                  onPress={() => handleStartChat(item)}
                >
                  <View style={[styles.searchResultAvatar, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="person" size={24} color={colors.textTertiary} />
                  </View>
                  <View style={styles.searchResultInfo}>
                    <Text style={[styles.searchResultName, { color: colors.text }]}>
                      {item.username}
                    </Text>
                    <Text style={[styles.searchResultEmail, { color: colors.textSecondary }]}>
                      {item.email}
                    </Text>
                  </View>
                  <MaterialIcons name="chat" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                userSearch.length > 0 ? (
                  <Text style={[styles.noResults, { color: colors.textTertiary }]}>
                    No users found
                  </Text>
                ) : null
              }
            />
          </View>
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal visible={groupModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Group</Text>
              <TouchableOpacity onPress={() => { setGroupModalVisible(false); setGroupName(''); setSelectedMembers([]); setGroupImage(null); }}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.groupImageRow}>
              <TouchableOpacity onPress={handlePickGroupImage} style={styles.groupImageBtn}>
                {groupImage ? (
                  <Image source={{ uri: groupImage }} style={styles.groupImagePreview} />
                ) : (
                  <View style={[styles.groupImagePlaceholder, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="camera-alt" size={24} color={colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, flex: 1 }]}>
                <MaterialIcons name="group" size={20} color={colors.textTertiary} />
                <TextInput
                  style={[styles.groupNameInput, { color: colors.text }]}
                  placeholder="Group name"
                  placeholderTextColor={colors.textTertiary}
                  value={groupName}
                  onChangeText={setGroupName}
                />
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Add members ({selectedMembers.length} selected)
            </Text>

            <SearchBar
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search users to add..."
            />
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              style={styles.memberList}
              renderItem={({ item }) => {
                const isSelected = selectedMembers.includes(item.uid);
                return (
                  <TouchableOpacity
                    style={[styles.searchResult, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSelectedMembers((prev) =>
                        isSelected
                          ? prev.filter((u) => u !== item.uid)
                          : [...prev, item.uid]
                      );
                    }}
                  >
                    <View style={[styles.searchResultAvatar, { backgroundColor: colors.inputBackground }]}>
                      <MaterialIcons name="person" size={24} color={colors.textTertiary} />
                    </View>
                    <View style={styles.searchResultInfo}>
                      <Text style={[styles.searchResultName, { color: colors.text }]}>
                        {item.username}
                      </Text>
                    </View>
                    <MaterialIcons
                      name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                      size={22}
                      color={isSelected ? colors.primary : colors.textTertiary}
                    />
                  </TouchableOpacity>
                );
              }}
            />
            {selectedMembers.length > 0 && (
              <TouchableOpacity
                style={[styles.createGroupBtn, { backgroundColor: colors.primary, opacity: creatingGroup ? 0.6 : 1 }]}
                onPress={handleCreateGroup}
                disabled={creatingGroup}
              >
                <Text style={styles.createGroupBtnText}>
                  {creatingGroup ? 'Creating...' : `Create Group (${selectedMembers.length} members)`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Sheet */}
      <Modal visible={!!profileSheetChat} transparent animationType="slide">
        <TouchableOpacity
          style={styles.profileSheetOverlay}
          activeOpacity={1}
          onPress={() => setProfileSheetChat(null)}
        >
          <View style={[styles.profileSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.profileSheetHandle, { backgroundColor: colors.textTertiary }]} />
            <View style={styles.profileSheetContent}>
              {profileSheetChat?.isGlobal ? (
                <View style={[styles.profileSheetAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="public" size={50} color={colors.primary} />
                </View>
              ) : profileSheetChat?.isGroup ? (
                <View style={[styles.profileSheetAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="group" size={50} color={colors.primary} />
                </View>
              ) : (
                <Avatar uri={getChatAvatar(profileSheetChat)} size={90} isBot={profileSheetChat?.id?.startsWith('zolbot__')} />
              )}
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {getChatDisplayName(profileSheetChat)}
              </Text>
              <Text style={[styles.profileSubtitle, { color: colors.textSecondary }]}>
                {profileSheetChat?.isGlobal
                  ? 'Public chat for everyone'
                  : profileSheetChat?.isGroup
                  ? `${profileSheetChat.participants?.length || 0} members`
                  : profileSheetChat?.id?.startsWith('zolbot__')
                  ? 'AI Assistant'
                  : (() => {
                      const otherUid = Object.keys(profileSheetChat?.participantMeta || {}).find((k) => k !== user?.uid);
                      const isOnline = otherUid ? onlineUsers[otherUid]?.online === true : false;
                      return isOnline ? 'Online' : 'Offline';
                    })()}
              </Text>
              {!profileSheetChat?.isGlobal && !profileSheetChat?.isGroup && !profileSheetChat?.id?.startsWith('zolbot__') && (() => {
                const otherUid = Object.keys(profileSheetChat?.participantMeta || {}).find((k) => k !== user?.uid);
                const isOnline = otherUid ? onlineUsers[otherUid]?.online === true : false;
                return isOnline ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
                    <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600' }}>Online</Text>
                  </View>
                ) : null;
              })()}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    gap: 10,
    zIndex: 10,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabMenuText: {
    fontSize: 15,
    fontWeight: '600',
  },
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '85%',
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  groupImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  groupImageBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  groupImagePreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  groupImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  memberList: {
    maxHeight: 200,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultEmail: {
    fontSize: 13,
    marginTop: 1,
  },
  noResults: {
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  createGroupBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  profileSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  profileSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  profileSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  profileSheetContent: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  profileSheetAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  profileSubtitle: {
    fontSize: 14,
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
