import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, IconButton, Text, TextInput } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { deleteMessage, markChatAsRead, sendImageMessage, sendMessage, setTyping, subscribeToMessages, subscribeToPresence } from '../services/chatService';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { colors } from '../theme/theme';
import EmojiPicker from '../components/EmojiPicker';

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
  const [showEmoji, setShowEmoji] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState(null);
  const listRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const isTyping = partnerPresence && Object.values(partnerPresence).some((p) => p.typing);
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
            <Text style={styles.headerName} numberOfLines={1}>{target?.username || target?.email || 'Unknown'}</Text>
            <Text style={styles.headerEmail} numberOfLines={1}>
              {isTyping ? 'typing...' : target?.email || ''}
            </Text>
          </View>
        </View>
      ),
    });
  }, [navigation, target, partnerPresence]);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(chatId, setMessages);
    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    const uid = profile?.uid || user?.uid;
    if (uid) markChatAsRead(chatId, uid);
  }, [chatId, profile?.uid, user?.uid]);

  useEffect(() => {
    const uid = profile?.uid || user?.uid;
    if (!uid || target?.uid === 'zolbot') return;
    const unsubscribe = subscribeToPresence(chatId, uid, setPartnerPresence);
    return unsubscribe;
  }, [chatId, profile?.uid, user?.uid, target?.uid]);

  useEffect(() => {
    return () => {
      const uid = profile?.uid || user?.uid;
      if (uid) setTyping(chatId, uid, false);
    };
  }, [chatId, profile?.uid, user?.uid]);

  const onTextChange = (value) => {
    setText(value);
    const uid = profile?.uid || user?.uid;
    if (!uid || target?.uid === 'zolbot') return;
    setTyping(chatId, uid, value.length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(chatId, uid, false);
      }, 3000);
    }
  };

  const onSend = async () => {
    const messageText = text.trim();
    if (!messageText || sending) return;

    setText('');
    setShowEmoji(false);
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

  const onSendImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to share images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) return;

    setSending(true);
    try {
      const imageUri = result.assets[0].uri;
      const imageUrl = await uploadToCloudinary(imageUri);
      const senderObj = {
        uid: profile?.uid || user?.uid,
        email: profile?.email || user?.email,
        username: profile?.username || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User'),
        photoURL: profile?.photoURL || user?.photoURL || '',
      };
      await sendImageMessage(chatId, senderObj, imageUrl);
    } catch {
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const onDeleteMessage = (item) => {
    const isMine = item.senderId === (user?.uid || profile?.uid);
    if (!isMine) return;

    Alert.alert(
      'Delete message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(chatId, item.id);
            } catch {
              Alert.alert('Error', 'Failed to delete message.');
            }
          },
        },
      ],
    );
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
            <Pressable
              onLongPress={() => onDeleteMessage(item)}
              style={[styles.bubble, mine ? styles.mine : styles.theirs]}
            >
              {item.imageUrl ? (
                <Avatar.Image source={{ uri: item.imageUrl }} size={200} style={styles.messageImage} />
              ) : null}
              {item.text ? (
                <Text style={mine ? styles.mineText : styles.theirsText}>{item.text}</Text>
              ) : null}
              <Text style={[styles.timeText, mine ? styles.mineTime : styles.theirsTime]}>
                {formatTime(item.createdAt)}
              </Text>
            </Pressable>
          );
        }}
      />

      {showEmoji && (
        <EmojiPicker
          onSelect={(emoji) => setText((prev) => prev + emoji)}
        />
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <IconButton
          icon="emoticon-outline"
          onPress={() => setShowEmoji((prev) => !prev)}
          size={24}
          iconColor={showEmoji ? colors.primary : colors.muted}
        />
        <IconButton
          icon="image"
          onPress={onSendImage}
          size={24}
          iconColor={colors.muted}
          disabled={sending}
        />
        <TextInput 
          value={text} 
          onChangeText={onTextChange} 
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
    flex: 1,
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
    alignSelf: 'flex-start',
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
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
    overflow: 'hidden',
  },
  theirsText: {
    color: colors.onSurface,
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    borderRadius: 12,
    marginBottom: 4,
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
    padding: 8,
    gap: 4,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceVariant,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    height: 44,
  },
});
