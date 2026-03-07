import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Surface, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { sendMessage, subscribeToMessages } from '../services/chatService';

export default function ChatRoomScreen({ route }) {
  const { chatId, target } = route.params;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(chatId, setMessages);
    return unsubscribe;
  }, [chatId]);

  const onSend = async () => {
    await sendMessage(chatId, profile, text);
    setText('');
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        {target?.photoURL ? (
          <Avatar.Image source={{ uri: target.photoURL }} size={40} />
        ) : (
          <Avatar.Text size={40} label={(target?.username || target?.email || '?').slice(0, 2).toUpperCase()} />
        )}
        <View>
          <Text variant="titleMedium">{target?.username || target?.email}</Text>
          <Text variant="bodySmall" style={styles.sub}>{target?.email}</Text>
        </View>
      </Surface>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === user.uid;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text>{item.text}</Text>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} mode="outlined" placeholder="Message" style={styles.input} />
        <IconButton icon="send" mode="contained" onPress={onSend} disabled={!text.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    margin: 10,
    borderRadius: 16,
  },
  sub: {
    opacity: 0.7,
  },
  list: {
    flex: 1,
    paddingHorizontal: 14,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#9D7CFF',
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#1A2340',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 6,
  },
  input: {
    flex: 1,
  },
});
