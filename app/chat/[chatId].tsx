import { useState, useEffect, useRef } from 'react';
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
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { Avatar } from '../../components/Avatar';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageInput } from '../../components/MessageInput';
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
  addGroupMembers,
  toggleGroupAdmin,
  leaveGroup,
  subscribeToUsersPresence,
  subscribeToChats,
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
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const [typingTimeout, setTypingTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [profileSheetUser, setProfileSheetUser] = useState<any>(null);
  const [profileSheetUserOnline, setProfileSheetUserOnline] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const wasAtBottom = useRef<boolean>(true);

  const isGlobal = chatId === GLOBAL_CHAT_ID;
  const isZolbot = chatId?.startsWith('zolbot__');
  const isGroup = chatId?.startsWith('group_');

  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, 'chats', chatId), (snap) => {
      if (snap.exists()) setChatData(snap.data());
    }, () => {});
    return unsub;
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !user) return;

    const unsubMessages = subscribeToMessages(chatId, (msgs: any[]) => {
      setMessages(msgs);
      setPendingMessages((prev) => {
        const before = prev.length;
        const realIds = new Set(msgs.map((m: any) => m.id));
        const next = prev.filter((p) => {
          if (realIds.has(p.id)) return false;
          const isDuplicate = msgs.some(
            (m: any) =>
              m.senderId === p.senderId &&
              m.text === p.text &&
              Math.abs(
                (m.createdAt?.toDate?.()?.getTime?.() || 0) - p.sentAt
              ) < 10000
          );
          return !isDuplicate;
        });
        if (before > 0 && next.length < before) {
          wasAtBottom.current = true;
        }
        return next;
      });
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

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToChats(user.uid, (chatList: any[]) => {
      setAllChats(chatList);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!chatData?.participantMeta || isGlobal || isGroup || isZolbot) return;
    const otherUid = Object.keys(chatData.participantMeta).find((k) => k !== user?.uid);
    if (!otherUid) return;
    const unsub = subscribeToUsersPresence([otherUid], (p: Record<string, any>) => {
      setOtherUserOnline(p[otherUid]?.online === true);
    });
    return unsub;
  }, [chatData, isGlobal, isGroup, isZolbot, user]);

  useEffect(() => {
    if (!profileSheetUser?.uid || profileSheetUser.uid === user?.uid || profileSheetUser.uid === 'zolbot') {
      setProfileSheetUserOnline(false);
      return;
    }
    const unsub = subscribeToUsersPresence([profileSheetUser.uid], (p: Record<string, any>) => {
      setProfileSheetUserOnline(p[profileSheetUser.uid]?.online === true);
    });
    return unsub;
  }, [profileSheetUser, user]);

  useEffect(() => {
    if (!memberSearch.trim()) {
      setMemberSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { findUsersByEmailOrUsername } = await import('../../src/services/chatService');
      const results = await findUsersByEmailOrUsername(memberSearch, user?.uid || '');
      const existingParticipants = chatData?.participants || [];
      setMemberSearchResults(results.filter((r: any) => !existingParticipants.includes(r.uid)));
    }, 400);
    return () => clearTimeout(timer);
  }, [memberSearch]);

  const getParticipants = () => {
    if (!chatData?.participantMeta) return [];
    return Object.entries(chatData.participantMeta).map(([uid, meta]) => ({
      uid,
      ...(meta as any),
    }));
  };

  const getOtherUser = () => {
    if (!chatData?.participantMeta || !user) return null;
    const entries = Object.entries(chatData.participantMeta);
    const other = entries.find(([key]) => key !== user.uid);
    return other ? (other[1] as any) : null;
  };

  const getRecentContacts = () => {
    const existingParticipants = chatData?.participants || [];
    const seen = new Set<string>(existingParticipants);
    const contacts: any[] = [];
    for (const chat of allChats) {
      if (chat.isGlobal || chat.isGroup || chat.id?.startsWith('zolbot__')) continue;
      if (!chat.participantMeta) continue;
      const other = Object.entries(chat.participantMeta).find(
        ([key]) => key !== user?.uid && key !== 'zolbot'
      );
      if (other && !seen.has(other[0])) {
        seen.add(other[0]);
        contacts.push({
          uid: other[0],
          username: (other[1] as any)?.username || 'User',
          email: (other[1] as any)?.email || '',
          photoURL: (other[1] as any)?.photoURL || null,
        });
      }
      if (contacts.length >= 10) break;
    }
    return contacts;
  };

  const getChatTitle = () => {
    if (isGlobal) return 'Global Chat';
    if (isZolbot) return 'Zolbot';
    if (isGroup) return chatData?.groupName || 'Group Chat';
    const other = getOtherUser();
    return other?.username || 'Chat';
  };

  const getChatAvatar = () => {
    if (isZolbot) return null;
    if (isGlobal) return null;
    if (isGroup && chatData?.groupImage) return chatData.groupImage;
    const other = getOtherUser();
    return other?.photoURL || null;
  };

  const getTypingText = () => {
    const typingUsers = Object.values(presence).filter((p: any) => p.typing);
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `typing...`;
    return 'Multiple people typing...';
  };

  const getProfileImageForSender = (senderId: string) => {
    if (chatData?.participantMeta?.[senderId]?.photoURL) {
      return chatData.participantMeta[senderId].photoURL;
    }
    return null;
  };

  const handleSend = async () => {
    if (!text.trim() || !userProfile || !chatId) return;
    const msgText = text.trim();
    setText('');
    setShowMentions(false);

    const tempId = `pending_${Date.now()}_${Math.random()}`;
    const pendingMsg = {
      id: tempId,
      text: msgText,
      senderId: user?.uid,
      senderUsername: userProfile.username,
      senderPhotoURL: userProfile.photoURL,
      status: 'pending',
      createdAt: null,
      sentAt: Date.now(),
    };
    setPendingMessages((prev) => [...prev, pendingMsg]);
    wasAtBottom.current = true;

    setSending(true);
    try {
      await sendMessage(chatId, userProfile, msgText);
    } catch (e: any) {
      setPendingMessages((prev) => prev.filter((p) => p.id !== tempId));
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

  const handleTextChange = (value: string) => {
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

    const lastAt = value.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === value.length - 1) {
      const participants = getParticipants();
      const suggestions = [
        { uid: 'zolbot', username: 'Zolbot', isBot: true },
        ...participants.filter((p) => p.uid !== user?.uid && p.uid !== 'zolbot'),
      ];
      setMentionSuggestions(suggestions);
      setShowMentions(true);
    } else if (lastAt >= 0 && lastAt === value.length - 2) {
      setShowMentions(false);
    } else if (lastAt >= 0 && value.length > lastAt + 1) {
      const query = value.substring(lastAt + 1).toLowerCase();
      const participants = getParticipants();
      const filtered = [
        { uid: 'zolbot', username: 'Zolbot', isBot: true },
        ...participants.filter((p) => p.uid !== user?.uid && p.uid !== 'zolbot'),
      ].filter((p) => p.username?.toLowerCase().includes(query));
      setMentionSuggestions(filtered);
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (mention: any) => {
    const lastAt = text.lastIndexOf('@');
    const before = text.substring(0, lastAt);
    setText(`${before}@${mention.username} `);
    setShowMentions(false);
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

  const handleAddMembers = async (newMembers: string[]) => {
    if (!chatId || newMembers.length === 0) return;
    try {
      await addGroupMembers(chatId, newMembers);
      setAddMemberVisible(false);
      setMemberSearch('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!chatId || !user) return;
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveGroup(chatId, user.uid);
          router.back();
        },
      },
    ]);
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    let date: Date;
    if (createdAt?.toDate) date = createdAt.toDate();
    else if (createdAt?.seconds) date = new Date(createdAt.seconds * 1000);
    else date = new Date(createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const allMessages = [...messages, ...pendingMessages].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return 1;
    if (a.status !== 'pending' && b.status === 'pending') return -1;
    const aTime = a.createdAt?.toDate?.()?.getTime?.() || a.sentAt || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime?.() || b.sentAt || 0;
    return aTime - bTime;
  });

  const filteredMessages = searchQuery.trim()
    ? allMessages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allMessages;

  const renderMessage = ({ item }: { item: any }) => {
    const isOwn = item.senderId === user?.uid;
    const isBotMsg = item.senderId === 'zolbot';
    const isPending = item.status === 'pending';

    const handleAvatarPress = () => {
      if (!item.senderId) return;
      if (item.senderId === user?.uid) {
        setProfileSheetVisible(true);
        setProfileSheetUser(null);
        return;
      }
      const meta = chatData?.participantMeta?.[item.senderId];
      if (meta) {
        setProfileSheetUser({ uid: item.senderId, ...meta });
        setProfileSheetVisible(true);
      } else if (item.senderId === 'zolbot') {
        setProfileSheetUser({ uid: 'zolbot', username: 'Zolbot', isBot: true, email: 'zolbot@zoldyck.ai' });
        setProfileSheetVisible(true);
      }
    };

    return (
      <MessageBubble
        text={item.text || ''}
        senderName={item.senderUsername || 'User'}
        senderPhotoURL={getProfileImageForSender(item.senderId) || item.senderPhotoURL}
        timestamp={isPending ? '' : formatTime(item.createdAt)}
        isOwn={isOwn}
        isBot={isBotMsg}
        isPending={isPending}
        isGroup={isGroup || isGlobal}
        imageUrl={item.imageUrl}
        onImagePress={(uri) => setImageViewerUri(uri)}
        onAvatarPress={handleAvatarPress}
      />
    );
  };

  const typingText = getTypingText();

  const getProfileSheetSubtitle = () => {
    if (profileSheetUser) return profileSheetUser.email || '';
    if (isGlobal) return 'Public chat room — everyone can join';
    if (isZolbot) return 'AI assistant built into Zolchat';
    if (isGroup) return `${chatData?.participants?.length || 0} members`;
    const other = getOtherUser();
    return other?.email || '';
  };

  const getProfileSheetAvatar = () => {
    if (profileSheetUser) return profileSheetUser.photoURL || null;
    return getChatAvatar();
  };

  const getProfileSheetTitle = () => {
    if (profileSheetUser) return profileSheetUser.username || 'User';
    return getChatTitle();
  };

  const getProfileSheetIsBot = () => {
    if (profileSheetUser) return profileSheetUser.isBot === true;
    return isZolbot;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setProfileSheetVisible(true)}
        >
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              {isGlobal ? (
                <View style={[styles.headerAvatar, { backgroundColor: colors.primary + '20' }]}>
                  <MaterialIcons name="public" size={22} color={colors.primary} />
                </View>
              ) : (
                <View>
                  <Avatar uri={getChatAvatar()} size={36} isBot={isZolbot} />
                  {!isGlobal && !isZolbot && !isGroup && otherUserOnline && (
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.surface }} />
                  )}
                </View>
              )}
              <View style={styles.headerText}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {getChatTitle()}
                </Text>
                {typingText ? (
                  <Text style={[styles.typingText, { color: colors.primary }]} numberOfLines={1}>
                    {typingText}
                  </Text>
                ) : isGroup && chatData?.participants ? (
                  <Text style={[styles.memberCount, { color: colors.textTertiary }]} numberOfLines={1}>
                    {chatData.participants.length} members
                  </Text>
                ) : !isGlobal && !isZolbot && !isGroup ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {otherUserOnline && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                    <Text style={[styles.memberCount, { color: otherUserOnline ? '#22C55E' : colors.textTertiary }]} numberOfLines={1}>
                      {otherUserOnline ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.headerBtn}>
              <MaterialIcons name="search" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerBtn}>
              <MaterialIcons name="more-vert" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* In-chat search bar */}
        {searchVisible && (
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: colors.inputBackground }]}>
              <MaterialIcons name="search" size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchTextInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search messages..."
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); }}>
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onScrollBeginDrag={() => { wasAtBottom.current = false; Keyboard.dismiss(); }}
            onScrollEndDrag={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
              wasAtBottom.current = isAtBottom;
            }}
            onContentSizeChange={() => {
              if (wasAtBottom.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onLayout={() => {
              if (wasAtBottom.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={[styles.emptyChatText, { color: colors.textTertiary }]}>
                  {isZolbot ? 'Start chatting with Zolbot!' : 'No messages yet. Say hello!'}
                </Text>
              </View>
            }
          />
        </View>

        {/* Mention Suggestions */}
        {showMentions && mentionSuggestions.length > 0 && (
          <View style={[styles.mentionContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <FlatList
              data={mentionSuggestions}
              keyExtractor={(item) => item.uid}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.mentionChip, { backgroundColor: colors.primary + '15' }]}
                  onPress={() => handleMentionSelect(item)}
                >
                  {item.isBot ? (
                    <MaterialIcons name="smart-toy" size={16} color={colors.primary} />
                  ) : (
                    <Avatar uri={item.photoURL} size={20} />
                  )}
                  <Text style={[styles.mentionChipText, { color: colors.primary }]}>
                    @{item.username}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Message Input */}
        <MessageInput
          value={text}
          onChangeText={handleTextChange}
          onSend={handleSend}
          onImagePick={handleImageSend}
          sending={sending}
        />

        {/* Options Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.profileSheetOverlay}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          >
            <View style={[styles.menuSheet, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
              <View style={[styles.profileSheetHandle, { backgroundColor: colors.text }]} />

              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={handleClearChat}
              >
                <MaterialIcons name="delete-sweep" size={22} color={colors.danger} />
                <Text style={[styles.menuItemText, { color: colors.danger }]}>Clear Chat</Text>
              </TouchableOpacity>
              {isGroup && (
                <>
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                    onPress={() => { setMenuVisible(false); setAddMemberVisible(true); }}
                  >
                    <MaterialIcons name="person-add" size={22} color={colors.primary} />
                    <Text style={[styles.menuItemText, { color: colors.text }]}>Add Members</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                    onPress={handleLeaveGroup}
                  >
                    <MaterialIcons name="exit-to-app" size={22} color={colors.danger} />
                    <Text style={[styles.menuItemText, { color: colors.danger }]}>Leave Group</Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity style={styles.menuItem} onPress={handleDeleteChat}>
                <MaterialIcons name="delete-forever" size={22} color={colors.danger} />
                <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete Chat</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Profile Sheet Modal */}
        <Modal visible={profileSheetVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.profileSheetOverlay}
            activeOpacity={1}
            onPress={() => { setProfileSheetVisible(false); setProfileSheetUser(null); }}
          >
            <View style={[styles.profileSheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.profileSheetHandle, { backgroundColor: colors.textTertiary }]} />

              <View style={styles.profileSheetContent}>
                {profileSheetUser ? (
                  <Avatar uri={getProfileSheetAvatar()} size={90} isBot={getProfileSheetIsBot()} />
                ) : isGlobal ? (
                  <View style={[styles.profileSheetAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <MaterialIcons name="public" size={50} color={colors.primary} />
                  </View>
                ) : (
                  <Avatar uri={getProfileSheetAvatar()} size={90} isBot={getProfileSheetIsBot()} />
                )}

                <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                  {getProfileSheetTitle()}
                </Text>
                <Text style={[styles.profileSubtitle, { color: colors.textSecondary }]}>
                  {getProfileSheetSubtitle()}
                </Text>

                {!profileSheetUser && !isGlobal && !isGroup && !isZolbot && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    {otherUserOnline && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                    <Text style={{ color: otherUserOnline ? '#22C55E' : colors.textTertiary, fontSize: 13, fontWeight: '600' }}>
                      {otherUserOnline ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                )}

                {profileSheetUser && !getProfileSheetIsBot() && profileSheetUser.uid !== user?.uid && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    {profileSheetUserOnline && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />}
                    <Text style={{ color: profileSheetUserOnline ? '#22C55E' : colors.textTertiary, fontSize: 13, fontWeight: '600' }}>
                      {profileSheetUserOnline ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                )}

                {isGlobal && (
                  <View style={[styles.profileInfoRow, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="public" size={20} color={colors.primary} />
                    <Text style={[styles.profileInfoText, { color: colors.text }]}>
                      Anyone in the app can send messages here
                    </Text>
                  </View>
                )}

                {isGroup && chatData?.participants && (
                  <View style={styles.profileMembersSection}>
                    <Text style={[styles.profileMembersTitle, { color: colors.textSecondary }]}>
                      Members
                    </Text>
                    {getParticipants().map((member) => (
                      <View
                        key={member.uid}
                        style={[styles.profileMemberRow, { borderBottomColor: colors.border }]}
                      >
                        <Avatar uri={member.photoURL} size={36} isBot={member.isBot} />
                        <View style={styles.profileMemberInfo}>
                          <Text style={[styles.profileMemberName, { color: colors.text }]}>
                            {member.username}
                          </Text>
                          {chatData.groupAdmins?.includes(member.uid) && (
                            <Text style={[styles.profileMemberRole, { color: colors.primary }]}>
                              Admin
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {!profileSheetUser && !isGlobal && !isGroup && !isZolbot && (
                  <View style={[styles.profileInfoRow, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="email" size={20} color={colors.textTertiary} />
                    <Text style={[styles.profileInfoText, { color: colors.text }]}>
                      {getOtherUser()?.email}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Add Members Modal */}
        <Modal visible={addMemberVisible} transparent animationType="slide">
          <TouchableOpacity
            style={styles.profileSheetOverlay}
            activeOpacity={1}
            onPress={() => { setAddMemberVisible(false); setMemberSearch(''); }}
          >
            <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Members</Text>
                <TouchableOpacity onPress={() => { setAddMemberVisible(false); setMemberSearch(''); }}>
                  <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.searchInputContainer, { backgroundColor: colors.inputBackground, marginBottom: 12, flex: undefined, height: 40 }]}>
                <MaterialIcons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                  style={[styles.searchTextInput, { color: colors.text }]}
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search users..."
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              {(() => {
                const recentContacts = getRecentContacts();
                const data = memberSearch.length > 0 ? memberSearchResults : recentContacts;
                return (
                  <FlatList
                    data={data}
                    keyExtractor={(item) => item.uid}
                    style={{ flex: 1 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.searchResult, { borderBottomColor: colors.border }]}
                        onPress={() => handleAddMembers([item.uid])}
                      >
                        <Avatar uri={item.photoURL} size={40} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.searchResultName, { color: colors.text }]}>
                            {item.username}
                          </Text>
                          {item.email ? (
                            <Text style={{ fontSize: 13, color: colors.textTertiary }} numberOfLines={1}>
                              {item.email}
                            </Text>
                          ) : null}
                        </View>
                        <MaterialIcons name="add-circle" size={24} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    ListHeaderComponent={
                      memberSearch.length === 0 && recentContacts.length > 0 ? (
                        <Text style={[styles.noResults, { color: colors.textTertiary, fontSize: 13, paddingTop: 12 }]}>
                          Recent contacts
                        </Text>
                      ) : null
                    }
                    ListEmptyComponent={
                      <Text style={[styles.noResults, { color: colors.textTertiary }]}>
                        {memberSearch.length > 0 ? 'No users found' : 'No other contacts found. Try searching above.'}
                      </Text>
                    }
                  />
                );
              })()}
            </TouchableOpacity>
            </SafeAreaView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
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
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  memberCount: {
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
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  messagesContainer: {
    flex: 1,
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
  mentionContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  mentionChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  profileSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  profileSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  profileSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.3,
  },
  profileSheetAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSheetContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  profileSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  profileInfoText: {
    fontSize: 14,
    flex: 1,
  },
  profileMembersSection: {
    width: '100%',
    marginTop: 16,
  },
  profileMembersTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  profileMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileMemberInfo: {
    flex: 1,
  },
  profileMemberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  profileMemberRole: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
  },
  noResults: {
    textAlign: 'center',
    paddingTop: 40,
    fontSize: 15,
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
