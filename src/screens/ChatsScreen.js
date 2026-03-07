import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, FAB, List, Portal, Searchbar, Surface, Text } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { findUsersByEmailOrUsername, startOrOpenChat, subscribeToChats } from '../services/chatService';

export default function ChatsScreen({ navigation }) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState([]);
  const [showComposer, setShowComposer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToChats(user.uid, setChats);
    return unsubscribe;
  }, [user?.uid]);

  const runSearch = async (value) => {
    setSearchTerm(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const found = await findUsersByEmailOrUsername(value, user.uid);
    setResults(found);
  };

  const openChatWithUser = async (target) => {
    const chatId = await startOrOpenChat(profile, target);
    setShowComposer(false);
    setSearchTerm('');
    setResults([]);
    navigation.navigate('ChatRoom', { chatId, target });
  };

  const items = useMemo(
    () =>
      chats.map((chat) => {
        const partnerId = chat.participants.find((participantId) => participantId !== user.uid);
        const partner = chat.participantMeta?.[partnerId] || {};
        return {
          ...chat,
          partner,
        };
      }),
    [chats, user.uid],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>No chats yet. Start a conversation with the + button.</Text>}
        renderItem={({ item }) => (
          <List.Item
            title={item.partner.username || item.partner.email || 'Unknown User'}
            description={item.lastMessage || 'Say hello 👋'}
            onPress={() => navigation.navigate('ChatRoom', { chatId: item.id, target: item.partner })}
            left={() =>
              item.partner.photoURL ? (
                <Avatar.Image source={{ uri: item.partner.photoURL }} size={44} />
              ) : (
                <Avatar.Text size={44} label={(item.partner.username || '?').slice(0, 2).toUpperCase()} />
              )
            }
          />
        )}
      />

      <Portal>
        {showComposer && (
          <Surface style={styles.composer}>
            <Text variant="titleMedium">Start new chat</Text>
            <Searchbar placeholder="Search by email or username" value={searchTerm} onChangeText={runSearch} style={styles.search} />
            <FlatList
              data={results}
              keyExtractor={(item) => item.uid}
              ListEmptyComponent={searchTerm ? <Text style={styles.emptySmall}>No user found.</Text> : null}
              renderItem={({ item }) => (
                <List.Item
                  title={item.username || item.email}
                  description={item.email}
                  onPress={() => openChatWithUser(item)}
                  left={() =>
                    item.photoURL ? (
                      <Avatar.Image source={{ uri: item.photoURL }} size={40} />
                    ) : (
                      <Avatar.Text size={40} label={(item.username || '?').slice(0, 2).toUpperCase()} />
                    )
                  }
                />
              )}
            />
            <FAB icon="close" style={styles.closeFab} onPress={() => setShowComposer(false)} size="small" />
          </Surface>
        )}
      </Portal>

      <FAB icon="plus" style={styles.fab} onPress={() => setShowComposer(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  composer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    gap: 10,
  },
  closeFab: {
    alignSelf: 'center',
    marginTop: 8,
  },
  search: {
    borderRadius: 12,
  },
  empty: {
    textAlign: 'center',
    marginTop: 28,
    opacity: 0.7,
    paddingHorizontal: 24,
  },
  emptySmall: {
    textAlign: 'center',
    marginTop: 10,
    opacity: 0.7,
  },
});
