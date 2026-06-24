import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { sendMessage, subscribeToMessages } from '../services/chatService';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export default function ChatRoomScreen({ route, navigation }) {
  const { chatId, target } = route.params;
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  // Set the screen header options dynamically to display target user info in standard stack header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          {target?.photoURL ? (
            <Avatar.Image source={{ uri: target.photoURL }} size={34} />
          ) : (
            <Avatar.Text 
              size={34} 
              label={(target?.username || target?.email || '?').slice(0, 2).toUpperCase()} 
              style={styles.headerAvatarBg}
              labelStyle={styles.headerAvatarText}
            />
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerName}>{target?.username || target?.email}</Text>
            <Text style={styles.headerEmail} numberOfLines={1}>{target?.email}</Text>
          </View>
        </View>
      ),
    });
  }, [navigation, target]);

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
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === user.uid;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={mine ? styles.mineText : styles.theirsText}>{item.text}</Text>
              <Text style={[styles.timeText, mine ? styles.mineTime : styles.theirsTime]}>
                {formatTime(item.createdAt)}
              </Text>
            </View>
          );
        }}
      />

      <View style={styles.composer}>
        <TextInput 
          value={text} 
          onChangeText={setText} 
          mode="outlined" 
          placeholder="Message" 
          placeholderTextColor="#637099"
          style={styles.input} 
          activeOutlineColor="#9D7CFF"
          outlineColor="#1A2340"
          textColor="#ECF1FF"
          theme={{ roundness: 24 }}
        />
        <IconButton 
          icon="send" 
          mode="contained" 
          onPress={onSend} 
          disabled={!text.trim()} 
          containerColor="#9D7CFF"
          iconColor="#090D1A"
          size={24}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D1A',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  headerAvatarBg: {
    backgroundColor: '#1A2340',
  },
  headerAvatarText: {
    color: '#9D7CFF',
    fontWeight: 'bold',
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerName: {
    color: '#ECF1FF',
    fontWeight: '700',
    fontSize: 15,
  },
  headerEmail: {
    color: '#637099',
    fontSize: 11,
    maxWidth: 200,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubble: {
    maxWidth: '75%',
    marginVertical: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 1,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#9D7CFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  mineText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#161D30',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  theirsText: {
    color: '#ECF1FF',
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
    fontWeight: '300',
  },
  mineTime: {
    color: '#E0D4FF',
  },
  theirsTime: {
    color: '#637099',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: '#12182C',
    borderTopWidth: 1,
    borderTopColor: '#1A2340',
  },
  input: {
    flex: 1,
    backgroundColor: '#090D1A',
    height: 48,
  },
});
