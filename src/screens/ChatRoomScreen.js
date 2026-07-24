import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, IconButton, ActivityIndicator, List, Modal, Portal, Surface, Text, TextInput } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { clearPresence, deleteMessage, forwardMessage, markChatAsRead, sendImageMessage, sendMessage, setTyping, subscribeToMessages, subscribeToPresence } from '../services/chatService';
import { uploadToCloudinary } from '../services/cloudinaryService';
import EmojiPicker from '../components/EmojiPicker';

const senderObjFromProfile = (profile, user) => ({
  uid: profile?.uid || user?.uid,
  email: profile?.email || user?.email,
  username: profile?.username || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User'),
  photoURL: profile?.photoURL || user?.photoURL || '',
});

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const LinkableText = ({ text, style }) => {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.match(/^(https?:\/\/[^\s]+)$/) ? (
          <Text
            key={i}
            style={[style, { textDecorationLine: 'underline' }]}
            onPress={() => Linking.openURL(part)}
          >
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
};

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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState(null);
  const [botCooldown, setBotCooldown] = useState(false);
  const [loadingImages, setLoadingImages] = useState({});
  const [showForward, setShowForward] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardItem, setForwardItem] = useState(null);
  const [chatList, setChatList] = useState([]);
  const listRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const typingTimeoutRef = useRef(null);
  const botCooldownRef = useRef(null);

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
      if (uid && target?.uid !== 'zolbot') {
        setTyping(chatId, uid, false);
        clearPresence(chatId, uid);
      }
      if (botCooldownRef.current) clearTimeout(botCooldownRef.current);
    };
  }, [chatId, profile?.uid, user?.uid, target?.uid]);

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
    if (target?.uid === 'zolbot' && botCooldown) {
      Alert.alert('Please wait', 'Zolbot is still thinking. Try again in a few seconds.');
      return;
    }

    setText('');
    setShowEmoji(false);
    setSending(true);
    try {
      await sendMessage(chatId, senderObjFromProfile(profile, user), messageText);
      if (target?.uid === 'zolbot') {
        setBotCooldown(true);
        if (botCooldownRef.current) clearTimeout(botCooldownRef.current);
        botCooldownRef.current = setTimeout(() => setBotCooldown(false), 5000);
      }
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
      await sendImageMessage(chatId, senderObjFromProfile(profile, user), imageUrl);
    } catch {
      Alert.alert('Error', 'Failed to send image. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const onLongPressMessage = (item) => {
    const isMine = item.senderId === (user?.uid || profile?.uid);
    const options = [
      { text: 'Forward', onPress: () => startForward(item) },
    ];
    if (isMine) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(item),
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message options', '', options);
  };

  const startForward = async (item) => {
    setForwardItem(item);
    setShowForward(true);
    try {
      const uid = user?.uid || profile?.uid;
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', uid), orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      const chats = snapshot.docs.filter((d) => d.id !== chatId).map((d) => ({ id: d.id, ...d.data() }));
      setChatList(chats);
    } catch {
      setChatList([]);
    }
  };

  const confirmForward = async () => {
    if (!forwardTarget || !forwardItem) return;
    try {
      const senderObj = senderObjFromProfile(profile, user);
      await forwardMessage(forwardTarget.id, senderObj, forwardItem.text, forwardItem.imageUrl);
      const partnerId = forwardTarget.participants?.find((p) => p !== (user?.uid || profile?.uid));
      const partnerName = forwardTarget.participantMeta?.[partnerId]?.username || 'chat';
      Alert.alert('Sent', `Message forwarded to ${partnerName}.`);
    } catch {
      Alert.alert('Error', 'Failed to forward message.');
    } finally {
      setShowForward(false);
      setForwardTarget(null);
      setForwardItem(null);
    }
  };

  const confirmDelete = (item) => {
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
              onLongPress={() => onLongPressMessage(item)}
              style={[styles.bubble, mine ? styles.mine : styles.theirs]}
            >
              {item.imageUrl ? (
                <View style={styles.imageContainer}>
                  {loadingImages[item.id] !== false && (
                    <ActivityIndicator style={styles.imageLoader} size="small" color={colors.primary} />
                  )}
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.messageImage}
                    resizeMode="cover"
                    onLoadStart={() => setLoadingImages((prev) => ({ ...prev, [item.id]: true }))}
                    onLoadEnd={() => setLoadingImages((prev) => ({ ...prev, [item.id]: false }))}
                  />
                </View>
              ) : null}
              {item.text ? (
                <LinkableText text={item.text} style={mine ? styles.mineText : styles.theirsText} />
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
          colors={colors}
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
          placeholder={botCooldown ? 'Zolbot is thinking...' : 'Message...'}
          placeholderTextColor={colors.muted}
          style={styles.input} 
          activeOutlineColor={colors.primary}
          outlineColor={colors.surfaceVariant}
          textColor={colors.onSurface}
          theme={{ roundness: 24 }}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
          editable={!botCooldown}
        />
        <IconButton 
          icon="send" 
          mode="contained" 
          onPress={onSend} 
          disabled={!text.trim() || sending || botCooldown} 
          containerColor={colors.primary}
          iconColor={colors.background}
          size={24}
        />
      </View>

      <Portal>
        <Modal visible={showForward} onDismiss={() => { setShowForward(false); setForwardTarget(null); setForwardItem(null); }} contentContainerStyle={styles.forwardModal}>
          <Text style={styles.forwardTitle}>Forward to...</Text>
          <FlatList
            data={chatList}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.forwardEmpty}>No other chats available.</Text>}
            renderItem={({ item }) => {
              const partnerId = item.participants?.find((p) => p !== (user?.uid || profile?.uid));
              const partner = item.participantMeta?.[partnerId] || {};
              return (
                <List.Item
                  title={partner.username || partner.email || 'Unknown'}
                  description={item.lastMessage || ''}
                  onPress={() => { setForwardTarget(item); }}
                  titleStyle={{ color: colors.onSurface }}
                  descriptionStyle={{ color: colors.muted }}
                  style={forwardTarget?.id === item.id ? { backgroundColor: colors.surfaceVariant, borderRadius: 8 } : undefined}
                />
              );
            }}
          />
          <IconButton
            icon="send"
            mode="contained"
            onPress={confirmForward}
            disabled={!forwardTarget}
            containerColor={colors.primary}
            iconColor={colors.background}
            style={styles.forwardSendBtn}
          />
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  headerAvatarBg: {
    backgroundColor: c.surfaceVariant,
  },
  headerAvatarText: {
    color: c.primary,
    fontWeight: 'bold',
  },
  headerTextContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  headerName: {
    color: c.onSurface,
    fontWeight: '700',
    fontSize: 15,
  },
  headerEmail: {
    color: c.muted,
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
    backgroundColor: c.primary,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    overflow: 'hidden',
  },
  mineText: {
    color: c.white,
    fontSize: 15,
    lineHeight: 20,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: c.chatTheirs,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  theirsText: {
    color: c.onSurface,
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: c.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLoader: {
    position: 'absolute',
    zIndex: 1,
  },
  timeText: {
    fontSize: 9,
    marginTop: 4,
    alignSelf: 'flex-end',
    fontWeight: '300',
  },
  mineTime: {
    color: c.white,
  },
  theirsTime: {
    color: c.muted,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 4,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.surfaceVariant,
  },
  input: {
    flex: 1,
    backgroundColor: c.background,
    height: 44,
  },
  forwardModal: {
    backgroundColor: c.surface,
    margin: 20,
    borderRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  forwardTitle: {
    color: c.onSurface,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  forwardEmpty: {
    color: c.muted,
    textAlign: 'center',
    marginTop: 24,
  },
  forwardSendBtn: {
    alignSelf: 'center',
    marginTop: 8,
  },
});
