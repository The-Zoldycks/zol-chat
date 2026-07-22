import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Avatar, IconButton, Text, TextInput } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { sendMessage, subscribeToMessages } from '../services/chatService';
import { colors } from '../theme/theme';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds != null) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '';
    }
    if (Number.isNaN(date.getTime())) return '';
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
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  // Set the screen header options dynamically to display target user info in standard stack header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          {target?.uid === 'zolbot' ? (
            <Avatar.Image source={require('../../assets/zolbot.jpg')} size={34} />
          ) : target?.photoURL ? (
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
            <Text style={styles.headerName}>{target?.username || target?.email || 'Unknown'}</Text>
            <Text style={styles.headerEmail} numberOfLines={1}>{target?.email || ''}</Text>
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
    const messageText = text.trim();
    if (!messageText || sending) return;

    setText('');
    setSending(true);
    try {
      const senderObj = {
        uid: profile?.uid || user?.uid,
        email: profile?.email || user?.email,
        username: profile?.username || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User'),
        photoURL: profile?.photoURL || user?.photoURL || '',
      };
      await sendMessage(chatId, senderObj, messageText);
    } catch {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.senderId === (user?.uid || profile?.uid);
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

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput 
          value={text} 
          onChangeText={setText} 
          mode="outlined" 
          placeholder="Message..." 
          placeholderTextColor={colors.muted}
          style={styles.input} 
          activeOutlineColor={colors.primary}
          outlineColor={colors.surfaceVariant}
          textColor={colors.onSurface}
          theme={{ roundness: 24 }}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
        <IconButton 
          icon="send" 
          mode="contained" 
          onPress={onSend} 
          disabled={!text.trim() || sending} 
          containerColor={colors.primary}
          iconColor={colors.background}
          size={24}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  headerAvatarBg: {
    backgroundColor: colors.surfaceVariant,
  },
  headerAvatarText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerName: {
    color: colors.onSurface,
    fontWeight: '700',
    fontSize: 15,
  },
  headerEmail: {
    color: colors.muted,
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
    backgroundColor: colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  mineText: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.chatTheirs,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  theirsText: {
    color: colors.onSurface,
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
    color: colors.white,
  },
  theirsTime: {
    color: colors.muted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    height: 48,
  },
});
