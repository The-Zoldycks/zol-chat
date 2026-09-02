import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { SearchBar } from '../../components/SearchBar';
import { Avatar } from '../../components/Avatar';
import {
  findUsersByEmailOrUsername,
  startOrOpenChat,
  GLOBAL_CHAT_ID,
} from '../../src/services/chatService';

export default function SearchScreen() {
  const { user, userProfile } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search users by username..."
        />
      </View>

      {!searchQuery.trim() && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quick Access</Text>
          {quickAccess.map((item) => (
            <TouchableOpacity
              key={item.uid}
              style={[styles.resultItem, { borderBottomColor: colors.border }]}
              onPress={() => handleStartChat(item)}
            >
              <View style={[styles.resultAvatar, { backgroundColor: colors.inputBackground }]}>
                <MaterialIcons
                  name={item.isBot ? 'smart-toy' : 'public'}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.resultInfo}>
                <Text style={[styles.resultName, { color: item.isGlobal ? colors.success : colors.text }]}>
                  {item.isGlobal && '🌍 '}{item.username}
                </Text>
                <Text style={[styles.resultSub, { color: colors.textSecondary }]}>
                  {item.email}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searchQuery.trim() ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultItem, { borderBottomColor: colors.border }]}
              onPress={() => handleStartChat(item)}
            >
              <Avatar uri={item.photoURL} size={44} isBot={item.isBot} />
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
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="person-search" size={56} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Find People
          </Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Search for users by username or email
          </Text>
        </View>
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
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
  },
});
