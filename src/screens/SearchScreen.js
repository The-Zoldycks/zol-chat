import { useEffect, useMemo, useState, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, List, Searchbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOnline } from '../context/OnlineContext';
import { findUsersByEmailOrUsername, startOrOpenChat, subscribeToChats } from '../services/chatService';
import { showAlert } from '../components/AppAlert';

export default function SearchScreen({ navigation }) {
  const { user, profile } = useAuth();
  const { colors, scaleFont } = useTheme();
  const { isOnline } = useOnline();
  const styles = useMemo(() => createStyles(colors, scaleFont), [colors, scaleFont]);
  const insets = useSafeAreaInsets();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToChats(user.uid, (data) => {
      setChats(data);
    });
    return unsubscribe;
  }, [user?.uid]);

  const recentContacts = useMemo(() => {
    const contactsMap = new Map();
    chats.forEach((chat) => {
      if (chat.isGroup || chat.isGlobal) return;
      const partnerId = chat.participants?.find((p) => p !== user?.uid);
      if (partnerId && !contactsMap.has(partnerId)) {
        const meta = chat.participantMeta?.[partnerId] || {};
        contactsMap.set(partnerId, {
          uid: partnerId,
          username: meta.username || meta.email || 'User',
          email: meta.email || '',
          photoURL: meta.photoURL || '',
        });
      }
    });
    return Array.from(contactsMap.values()).slice(0, 10);
  }, [chats, user?.uid]);

  const runSearch = useCallback(async (value) => {
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
  }, [user?.uid]);

  const openChatWithUser = useCallback(async (target) => {
    try {
      const chatId = await startOrOpenChat(profile, target);
      setSearchTerm('');
      setResults([]);
      navigation.navigate('ChatRoom', { chatId, target });
    } catch (err) {
      showAlert('Error', err?.message || 'Could not start chat. Please try again.', [{ text: 'OK' }]);
    }
  }, [profile, navigation]);

  const displayData = searchTerm.trim() ? results : recentContacts;
  const title = searchTerm.trim() ? 'Search Results' : 'Recent Chats';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={styles.headerSubtitle}>Find users by email or username</Text>
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search by email or username"
          value={searchTerm}
          onChangeText={runSearch}
          style={styles.searchBar}
          placeholderTextColor={colors.muted}
          iconColor={colors.muted}
          textColor={colors.onSurface}
          loading={searching}
        />
      </View>

      <Text style={styles.sectionTitle}>{title}</Text>

      <FlatList
        data={displayData}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchTerm.trim() ? 'No users found.' : 'No recent chats.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => openChatWithUser(item)}>
            <View style={styles.contactItem}>
              <View style={styles.contactAvatar}>
                {item.photoURL ? (
                  <Avatar.Image source={{ uri: item.photoURL }} size={44} />
                ) : (
                  <Avatar.Text
                    size={44}
                    label={(item.username || item.email || '?').slice(0, 2).toUpperCase()}
                    style={styles.avatarTextBg}
                    labelStyle={styles.avatarLabel}
                  />
                )}
                {isOnline(item.uid) && <View style={styles.onlineDot} />}
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>{item.username}</Text>
                <Text style={styles.contactEmail} numberOfLines={1}>{item.email}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const createStyles = (c, sf) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: sf(24),
    fontWeight: '700',
    color: c.onSurface,
  },
  headerSubtitle: {
    fontSize: sf(13),
    color: c.muted,
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    borderRadius: 14,
    backgroundColor: c.surface,
    height: 44,
  },
  sectionTitle: {
    fontSize: sf(13),
    fontWeight: '600',
    color: c.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  contactAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: sf(15),
    fontWeight: '600',
    color: c.onSurface,
  },
  contactEmail: {
    fontSize: sf(12),
    color: c.muted,
    marginTop: 1,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: c.surface,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    textAlign: 'center',
    color: c.muted,
    fontSize: 15,
    paddingHorizontal: 40,
  },
});
