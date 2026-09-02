import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { Avatar } from '../../components/Avatar';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageInput } from '../../components/MessageInput';
import { MentionText } from '../../components/MentionText';
import {
  subscribeToMessages,
  subscribeToPresence,
  sendMessage,
  sendImageMessage,
  markChatAsRead,
  setTyping,
  clearPresence,
  clearChatMessages,
  deleteChat,
  GLOBAL_CHAT_ID,
} from '../../src/services/chatService';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import * as ImagePicker from 'expo-image-picker';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user, userProfile } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const isGlobal = chatId === GLOBAL_CHAT_ID;
  const isZolbot = chatId?.startsWith('zolbot__');
  const isGroup = chatId?.startsWith('group_');

  useEffect(() => {
    if (!chatId || !user) return;

    const unsubMessages = subscribeToMessages(chatId, (msgs: any[]) => {
      setMessages(msgs);
    });

    const unsubPresence = subscribeToPresence(chatId, user.uid, (p: Record<string, any>) => {
      setPresence(p);
    });

    markChatAsRead(chatId, user.uid).catch(() => {});

    return () => {
      unsubMessages();
      unsubPresence();
      clearPresence(chatId, user.uid).catch(() => {});
    };
  }, [chatId, user]);

  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, []);

  const getChatTitle = () => {
    if (isGlobal) return 'Global Chat';
    if (isZolbot) return 'Zolbot';
    const lastMsg = messages[messages.length - 1];
    if (isGroup) return `Group Chat`;
    return 'Chat';
  };

  const getTypingText = () => {
    const typingUsers = Object.values(presence).filter((p: any) => p.typing);
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].uid} is typing...`;
    return 'Multiple people typing...';
  };

  const handleSend = async () => {
    if (!text.trim() || !userProfile || !chatId) return;
    const msgText = text.trim();
    setText('');
    setSending(true);

    try {
      await sendMessage(chatId, userProfile, msgText);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleImageSend = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && userProfile && chatId) {
      setSending(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        await sendImageMessage(chatId, userProfile, url);
      } catch (e: any) {
        Alert.alert('Error', 'Failed to send image');
      } finally {
        setSending(false);
      }
    }
  };

  const handleTyping = (value: string) => {
    setText(value);
    if (!chatId || !user) return;

    if (value.length > 0) {
      setTyping(chatId, user.uid, true);
      if (typingTimeout) clearTimeout(typingTimeout);
      const timeout = setTimeout(() => {
        setTyping(chatId, user.uid, false);
      }, 2000);
      setTypingTimeout(timeout);
    } else {
      setTyping(chatId, user.uid, false);
    }
  };

  const handleClearChat = async () => {
    if (!chatId) return;
    Alert.alert('Clear Chat', 'Delete all messages in this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearChatMessages(chatId);
          setMenuVisible(false);
        },
      },
    ]);
  };

  const handleDeleteChat = async () => {
    if (!chatId) return;
    Alert.alert('Delete Chat', 'This will permanently delete this chat and all messages.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChat(chatId);
          setMenuVisible(false);
          router.back();
        },
      },
    ]);
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    let date: Date;
    if (createdAt.toDate) date = createdAt.toDate();
    else if (createdAt.seconds) date = new Date(createdAt.seconds * 1000);
    else date = new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId === user?.uid;
    const isBotMsg = item.senderId === 'zolbot';

    return (
      <View>
        <MessageBubble
          text={item.text || ''}
          senderName={item.senderUsername || 'User'}
          senderPhotoURL={item.senderPhotoURL}
          timestamp={formatTime(item.createdAt)}
          isOwn={isOwn}
          isBot={isBotMsg}
          isPending={item.status === 'pending'}
          imageUrl={item.imageUrl}
          onImagePress={(uri) => setImageViewerUri(uri)}
        />
      </View>
    );
  };

  const typingText = getTypingText();

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Avatar
            uri={null}
            size={36}
            isBot={isZolbot}
          />
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {isGlobal ? '🌍 ' : ''}{getChatTitle()}
            </Text>
            {typingText && (
              <Text style={[styles.typingText, { color: colors.primary }]} numberOfLines={1}>
                {typingText}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.headerBtn}>
          <MaterialIcons name="search" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn}>
          <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* In-chat search bar */}
      {searchVisible && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <MaterialIcons name="search" size={18} color={colors.textTertiary} />
          <View style={[styles.searchInput, { backgroundColor: colors.inputBackground }]}>
            <MaterialIcons name="search" size={16} color={colors.textTertiary} />
            <Text
              style={[styles.searchInputText, { color: searchQuery ? colors.text : colors.textTertiary }]}
            >
              {searchQuery || 'Search messages...'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); }}>
            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={filteredMessages}
        keyExtractor={(item) => item.id || Math.random().toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: colors.textTertiary }]}>
              {isZolbot ? 'Start chatting with Zolbot!' : 'No messages yet. Say hello!'}
            </Text>
          </View>
        }
      />

      {/* Message Input */}
      <MessageInput
        value={text}
        onChangeText={handleTyping}
        onSend={handleSend}
        onImagePick={handleImageSend}
        sending={sending}
      />

      {/* Options Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.menuOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuDropdown, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={handleClearChat}
            >
              <MaterialIcons name="delete-sweep" size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Clear Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteChat}>
              <MaterialIcons name="delete-forever" size={20} color={colors.danger} />
              <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete Chat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={!!imageViewerUri} transparent animationType="fade">
        <TouchableOpacity
          style={[styles.imageViewerOverlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}
          activeOpacity={1}
          onPress={() => setImageViewerUri(null)}
        >
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setImageViewerUri(null)}
          >
            <MaterialIcons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {imageViewerUri && (
            <Image
              source={{ uri: imageViewerUri }}
              style={styles.imageViewer}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  backBtn: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  typingText: {
    fontSize: 12,
    marginTop: 1,
  },
  headerBtn: {
    padding: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInputText: {
    fontSize: 14,
  },
  messagesList: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyChatText: {
    fontSize: 15,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 12,
  },
  menuDropdown: {
    borderRadius: 12,
    minWidth: 180,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  imageViewerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewer: {
    width: SCREEN_WIDTH - 40,
    height: SCREEN_WIDTH - 40,
  },
});
