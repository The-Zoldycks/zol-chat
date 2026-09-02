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
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { ChatListItem } from '../../components/ChatListItem';
import { SearchBar } from '../../components/SearchBar';
import {
  subscribeToChats,
  getUnreadCounts,
  ensureGlobalChatExists,
  findUsersByEmailOrUsername,
  startOrOpenChat,
  createGroupChat,
} from '../../src/services/chatService';

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

  useEffect(() => {
    if (!user) return;
    ensureGlobalChatExists().catch(() => {});

    const unsub = subscribeToChats(user.uid, async (chatList: any[]) => {
      setChats(chatList);
      const counts = await getUnreadCounts(user.uid, chatList);
      setUnreadCounts(counts as Record<string, number>);
    });

    return unsub;
  }, [user]);

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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
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

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !userProfile) return;
    try {
      const groupId = await createGroupChat({
        groupName: groupName.trim(),
        participants: selectedMembers,
        creator: userProfile,
      });
      setGroupModalVisible(false);
      setGroupName('');
      setSelectedMembers([]);
      router.push(`/chat/${groupId}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getChatDisplayName = (chat: any) => {
    if (chat.isGlobal) return 'Global Chat';
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            onPress={() => router.push(`/chat/${item.id}`)}
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

      {/* Search Users Modal */}
      <Modal visible={searchModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Find Users</Text>
              <TouchableOpacity onPress={() => { setSearchModalVisible(false); setSearchResults([]); }}>
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
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Group</Text>
              <TouchableOpacity onPress={() => { setGroupModalVisible(false); setGroupName(''); setSelectedMembers([]); }}>
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
              <MaterialIcons name="group" size={20} color={colors.textTertiary} />
              <Text
                style={[styles.groupNameInput, { color: colors.text }]}
              >
                {groupName || ''}
              </Text>
              {groupName.length === 0 && (
                <Text style={[styles.groupNamePlaceholder, { color: colors.textTertiary }]}>
                  Group name
                </Text>
              )}
            </View>
            <SearchBar
              value={userSearch}
              onChangeText={setUserSearch}
              placeholder="Search users to add..."
            />
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
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
                style={[styles.createGroupBtn, { backgroundColor: colors.primary }]}
                onPress={handleCreateGroup}
              >
                <Text style={styles.createGroupBtnText}>
                  Create Group ({selectedMembers.length} members)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {fabOpen && (
        <TouchableOpacity
          style={[styles.fabBackdrop, { backgroundColor: 'transparent' }]}
          onPress={() => setFabOpen(false)}
          activeOpacity={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    maxHeight: '80%',
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
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 12,
    gap: 8,
  },
  groupNameInput: {
    flex: 1,
    fontSize: 16,
  },
  groupNamePlaceholder: {
    fontSize: 16,
    position: 'absolute',
    left: 42,
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
});
