import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Avatar, FAB, List, Portal, Searchbar, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { findUsersByEmailOrUsername, startOrOpenChat, subscribeToChats } from '../services/chatService';

export default function ChatsScreen({ navigation }) {
  const { user, profile, isNewUser, setIsNewUser } = useAuth();
  const [chats, setChats] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const insets = useSafeAreaInsets();

  // Redirect new users to Settings page to finish their profile setup
  useEffect(() => {
    if (isNewUser) {
      setIsNewUser(false);
      navigation.navigate('Settings');
    }
  }, [isNewUser, navigation, setIsNewUser]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToChats(user.uid, setChats);
    return unsubscribe;
  }, [user?.uid]);

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
        updatedAt: new Date(0),
      });
    }

    return chatItems;
  }, [chats, user?.uid]);

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No chats yet. Start a conversation with the + button.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.chatItemContainer}>
            <List.Item
              title={item.partner.username || item.partner.email || 'Unknown User'}
              description={item.lastMessage || 'Say hello 👋'}
              onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, target: item.partner })}
              titleStyle={styles.chatTitle}
              descriptionStyle={styles.chatDescription}
              left={() => (
                <View style={styles.avatarContainer}>
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
                </View>
              )}
            />
          </View>
        )}
      />

      <Portal>
        {showComposer && (
          <View style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={closeComposer} />
            <Surface style={styles.composer} elevation={4}>
              <Text variant="titleMedium" style={styles.composerTitle}>Start new chat</Text>
              <Searchbar 
                placeholder="Search by email or username" 
                value={searchTerm} 
                onChangeText={runSearch} 
                style={styles.search} 
                placeholderTextColor="#637099"
                iconColor="#637099"
                textColor="#ECF1FF"
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
                color="#ECF1FF"
              />
            </Surface>
          </View>
        )}
      </Portal>

      <FAB 
        icon="plus" 
        style={[styles.fab, { bottom: Math.max(insets.bottom + 16, 20) }]} 
        color="#090D1A" 
        onPress={() => setShowComposer(true)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D1A',
  },
  listContainer: {
    paddingVertical: 8,
  },
  chatItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#12182C',
    paddingVertical: 4,
  },
  chatTitle: {
    color: '#ECF1FF',
    fontWeight: '600',
    fontSize: 16,
  },
  chatDescription: {
    color: '#637099',
    fontSize: 13,
    marginTop: 2,
  },
  avatarContainer: {
    justifyContent: 'center',
    marginRight: 8,
    paddingLeft: 4,
  },
  avatarTextBg: {
    backgroundColor: '#1A2340',
  },
  avatarLabel: {
    color: '#9D7CFF',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  empty: {
    textAlign: 'center',
    color: '#637099',
    fontSize: 15,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#9D7CFF',
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
    backgroundColor: '#12182C',
    borderWidth: 1,
    borderColor: '#1A2340',
    borderBottomWidth: 0,
  },
  composerTitle: {
    color: '#ECF1FF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  search: {
    borderRadius: 14,
    backgroundColor: '#090D1A',
  },
  searchResultsList: {
    marginTop: 4,
  },
  searchItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A2340',
    paddingVertical: 2,
  },
  searchResultTitle: {
    color: '#ECF1FF',
    fontWeight: '600',
  },
  searchResultDesc: {
    color: '#637099',
  },
  searchAvatarContainer: {
    justifyContent: 'center',
    marginRight: 6,
  },
  emptySmall: {
    textAlign: 'center',
    marginTop: 16,
    color: '#637099',
  },
  closeFab: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#1A2340',
  },
});
