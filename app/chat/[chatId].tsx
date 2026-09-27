import { useState, useEffect, useRef, useMemo } from 'react';
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
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { db } from '../../src/services/firebase';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { useUserProfiles } from '../../src/hooks/useUserProfiles';
import { Avatar } from '../../components/Avatar';
import { MessageBubble } from '../../components/MessageBubble';
import { MessageInput } from '../../components/MessageInput';
import { ChatListItem } from '../../components/ChatListItem';
import { SearchBar } from '../../components/SearchBar';
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
  toggleMessageReaction,
  editMessage,
  deleteMessage,
  GLOBAL_CHAT_ID,
} from '../../src/services/chatService';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import { confirm } from '../../src/utils/confirm';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';

const SCREEN_WIDTH = Dimensions.get('window').width;

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const MEMBER_COLORS = ['#E879F9', '#38BDF8', '#FB923C', '#4ADE80', '#F472B6', '#A78BFA', '#FACC15', '#2DD4BF', '#FB7185', '#60A5FA', '#C084FC', '#A3E635'];

function getMemberColor(memberId: string) {
  let hash = 0;
  for (let i = 0; i < memberId.length; i += 1) {
    hash = (hash * 31 + memberId.charCodeAt(i)) | 0;
  }
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user, userProfile } = useAuth();
  const colors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;

  const [messages, setMessages] = useState<any[]>([]);
  const [pendingMessages, setPendingMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reactTarget, setReactTarget] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chatData, setChatData] = useState<any>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [chatListSearch, setChatListSearch] = useState('');
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [profileSheetUser, setProfileSheetUser] = useState<any>(null);
  const [profileSheetUserOnline, setProfileSheetUserOnline] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const wasAtBottom = useRef<boolean>(true);
  const swipeableRefs = useRef(new Map<string, any>());

  const closeOtherSwipeables = (exceptId: string) => {
    swipeableRefs.current.forEach((ref: any, id: string) => {
      if (id !== exceptId) ref?.close?.();
    });
  };

  const renderReplyAction = (_progress: any, dragX: any) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0.5, 1],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[styles.swipeAction, { transform: [{ scale }] }]}>
        <MaterialIcons name="reply" size={24} color={colors.primary} />
      </Animated.View>
    );
  };

  const isGlobal = chatId === GLOBAL_CHAT_ID;
  const isZolbot = chatId?.startsWith('zolbot__') || (chatData?.participantMeta as any)?.zolbot?.isBot === true;
  const isGroup = chatId?.startsWith('group_') || (chatData as any)?.isGroup === true;
  const canManageGroup =
    isGroup &&
    ((chatData?.groupAdmins?.length ?? 0) === 0 || chatData?.groupAdmins?.includes(user?.uid));

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
      // Messages arriving while viewing should not stay "unread" in the list.
      const latest = msgs[msgs.length - 1];
      if (latest && latest.senderId !== user?.uid) {
        markChatAsRead(chatId, user.uid).catch(() => {});
      }
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
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (chatId && user) {
        Promise.resolve(setTyping(chatId, user.uid, false)).catch(() => {});
      }
    };
  }, [chatId, user]);

  useEffect(() => {
    setEditingMessage(null);
    setReactTarget(null);
    setReplyingTo(null);
    setHighlightId(null);
  }, [chatId]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
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
    const otherUid = getOtherUid();
    if (otherUid && liveProfiles[otherUid]?.username) return liveProfiles[otherUid].username;
    const other = getOtherUser();
    return other?.username || 'Chat';
  };

  const getOtherUid = () => {
    if (!chatData?.participantMeta || !user) return null;
    return Object.keys(chatData.participantMeta).find((key) => key !== user.uid) || null;
  };

  const getChatAvatar = () => {
    if (isZolbot) return null;
    if (isGlobal) return null;
    if (isGroup && chatData?.groupImage) return chatData.groupImage;
    const otherUid = getOtherUid();
    if (otherUid && liveProfiles[otherUid]?.photoURL) return liveProfiles[otherUid].photoURL;
    const other = getOtherUser();
    return other?.photoURL || null;
  };

  const getTypingText = () => {
    const typingUsers = Object.values(presence).filter((p: any) => p.typing);
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `typing...`;
    return 'Multiple people typing...';
  };

  const getProfileImageForSender = (senderId: string, fallback?: string | null) => {
    return liveProfiles[senderId]?.photoURL || chatData?.participantMeta?.[senderId]?.photoURL || fallback || null;
  };

  const getLiveUsername = (uid: string | undefined, fallback?: string | null) => {
    if (uid && liveProfiles[uid]?.username) return liveProfiles[uid].username;
    return fallback || null;
  };

  const handleSend = async () => {
    if (!text.trim() || !user || !chatId) return;
    const msgText = text.trim();
    setText('');
    setShowMentions(false);

    const activeProfile = userProfile || {
      uid: user.uid,
      email: user.email || '',
      username: user.displayName || user.email?.split('@')[0] || 'User',
      usernameLower: (user.displayName || user.email?.split('@')[0] || 'user').toLowerCase(),
      photoURL: user.photoURL || '',
    };

    const replyRef = buildReplyRef();
    const tempId = `pending_${Date.now()}_${Math.random()}`;
    const pendingMsg = {
      id: tempId,
      text: msgText,
      senderId: user.uid,
      senderUsername: activeProfile.username,
      senderPhotoURL: activeProfile.photoURL,
      status: 'pending',
      replyTo: replyRef,
      createdAt: null,
      sentAt: Date.now(),
    };
    setPendingMessages((prev) => [...prev, pendingMsg]);
    setReplyingTo(null);
    wasAtBottom.current = true;

    setSending(true);
    try {
      await sendMessage(chatId, activeProfile, msgText, replyRef);
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

    if (result.canceled || !result.assets[0]) return;
    if (!userProfile || !chatId) {
      Alert.alert('Not Ready', 'Your profile is still loading. Please try again in a moment.');
      return;
    }
    setSending(true);
    try {
      const url = await uploadToCloudinary(result.assets[0].uri);
      await sendImageMessage(chatId, userProfile, url, buildReplyRef());
      setReplyingTo(null);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    console.log('[Chat] react tapped:', messageId, emoji, 'user:', user?.uid || 'none');
    setReactTarget(null);
    if (!user) return;
    try {
      await toggleMessageReaction(chatId, messageId, user.uid, emoji);
      console.log('[Chat] reaction saved:', messageId, emoji);
    } catch (e: any) {
      console.warn('[Chat] reaction failed:', e?.message);
      Alert.alert('Error', e?.message || 'Could not add reaction');
    }
  };

  const buildReplyRef = () => {
    if (!replyingTo) return null;
    return {
      id: replyingTo.id,
      text: replyingTo.text || '',
      senderId: replyingTo.senderId,
      senderName: getLiveUsername(replyingTo.senderId, replyingTo.senderUsername) || 'User',
    };
  };

  const startReply = () => {
    if (!reactTarget) return;
    setReplyingTo(reactTarget);
    setReactTarget(null);
  };

  const jumpToMessage = (messageId: string) => {
    const index = filteredMessages.findIndex((m: any) => m.id === messageId);
    if (index < 0) return;
    try {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch {}
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightId(messageId);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1500);
  };

  const startEdit = () => {
    console.log('[Chat] edit tapped, target:', reactTarget?.id || 'none');
    if (!reactTarget) return;
    setEditingMessage(reactTarget);
    setText(reactTarget.text || '');
    setReactTarget(null);
  };

  const handleSaveEdit = async () => {
    console.log('[Chat] save edit, editing:', editingMessage?.id || 'none');
    if (!editingMessage || !text.trim() || !user) return;
    try {
      await editMessage(chatId, editingMessage.id, user.uid, text);
      console.log('[Chat] edit saved:', editingMessage.id);
    } catch (e: any) {
      console.warn('[Chat] edit failed:', e?.message);
      Alert.alert('Error', e?.message || 'Could not edit message');
      return;
    }
    setEditingMessage(null);
    setText('');
  };

  const handleDeleteMessage = () => {
    const target = reactTarget;
    if (!target || !user) return;
    confirm('Delete Message', 'Delete this message for everyone?', async () => {
      await deleteMessage(chatId, target.id, user.uid);
      setReactTarget(null);
    }, { confirmText: 'Delete', destructive: true });
  };

  const handleCopyMessage = async () => {
    const target = reactTarget;
    setReactTarget(null);
    if (target?.text) {
      try {
        await Clipboard.setStringAsync(target.text);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Could not copy message');
      }
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (!chatId || !user) return;

    if (value.length > 0) {
      setTyping(chatId, user.uid, true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        setTyping(chatId, user.uid, false);
      }, 2000);
    } else {
      setTyping(chatId, user.uid, false);
    }

    const withLiveNames = (list: any[]) =>
      list.map((p) => ({ ...p, username: getLiveUsername(p.uid, p.username) || p.username }));
    const lastAt = value.lastIndexOf('@');
    if (lastAt >= 0 && lastAt === value.length - 1) {
      const participants = getParticipants();
      const suggestions = withLiveNames([
        { uid: 'zolbot', username: 'Zolbot', isBot: true },
        ...participants.filter((p) => p.uid !== user?.uid && p.uid !== 'zolbot'),
      ]);
      setMentionSuggestions(suggestions);
      setShowMentions(true);
    } else if (lastAt >= 0 && lastAt === value.length - 2) {
      setShowMentions(false);
    } else if (lastAt >= 0 && value.length > lastAt + 1) {
      const query = value.substring(lastAt + 1).toLowerCase();
      const participants = getParticipants();
      const filtered = withLiveNames([
        { uid: 'zolbot', username: 'Zolbot', isBot: true },
        ...participants.filter((p) => p.uid !== user?.uid && p.uid !== 'zolbot'),
      ]).filter((p) => p.username?.toLowerCase().includes(query));
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
    confirm('Clear Chat', 'Delete all messages in this chat?', async () => {
      await clearChatMessages(chatId);
      setMenuVisible(false);
    }, { confirmText: 'Clear', destructive: true });
  };

  const handleDeleteChat = async () => {
    if (!chatId) return;
    confirm('Delete Chat', 'This will permanently delete this chat and all messages.', async () => {
      await deleteChat(chatId);
      setMenuVisible(false);
      router.back();
    }, { confirmText: 'Delete', destructive: true });
  };

  const handleAddMembers = async (newMembers: string[]) => {
    if (!chatId || newMembers.length === 0) return;
    try {
      await addGroupMembers(chatId, newMembers, user?.uid || '');
      setAddMemberVisible(false);
      setMemberSearch('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!chatId || !user) return;
    confirm('Leave Group', 'Are you sure you want to leave this group?', async () => {
      await leaveGroup(chatId, user.uid);
      router.back();
    }, { confirmText: 'Leave', destructive: true });
  };

  const formatTime = (createdAt: any) => {
    if (!createdAt) return '';
    let date: Date;
    if (createdAt?.toDate) date = createdAt.toDate();
    else if (createdAt?.seconds) date = new Date(createdAt.seconds * 1000);
    else date = new Date(createdAt);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return time;
    if (days === 1) return `Yesterday, ${time}`;
    if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })}, ${time}`;
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
    }
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, ${time}`;
  };

  const getMsgTime = (m: any) => {
    if (m.createdAt?.toDate) return m.createdAt.toDate().getTime();
    if (m.createdAt?.seconds) return m.createdAt.seconds * 1000;
    if (m.createdAt instanceof Date) return m.createdAt.getTime();
    if (typeof m.createdAt === 'number') return m.createdAt;
    if (m.sentAt) return m.sentAt;
    return Date.now();
  };

  const allMessages = [...messages, ...pendingMessages].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return 1;
    if (a.status !== 'pending' && b.status === 'pending') return -1;
    const aTime = getMsgTime(a);
    const bTime = getMsgTime(b);
    return aTime - bTime;
  });

  const filteredMessages = searchQuery.trim()
    ? allMessages.filter((m) =>
        m.text?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allMessages;

  const lastMessageId = filteredMessages.length > 0
    ? filteredMessages[filteredMessages.length - 1].id
    : null;

  useEffect(() => {
    if (!wasAtBottom.current) return;
    const t = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [lastMessageId]);

  // Live profile photos: the users collection is the single source of truth,
  // so avatars refresh everywhere the moment someone changes their photo.
  const senderIds = useMemo(() => {
    const ids = new Set<string>();
    filteredMessages.forEach((m: any) => {
      if (m.senderId) ids.add(m.senderId);
    });
    // Include chat participants so the header and profile sheet resolve live
    // too, even before anyone has sent a message.
    if (chatData?.participantMeta) {
      Object.keys(chatData.participantMeta).forEach((uid) => {
        if (uid !== 'zolbot') ids.add(uid);
      });
    }
    allChats.forEach((chat) => {
      Object.keys(chat.participantMeta || {}).forEach((uid) => {
        if (uid !== 'zolbot' && uid !== user?.uid) ids.add(uid);
      });
    });
    return [...ids];
  }, [filteredMessages, chatData, allChats, user]);
  const liveProfiles = useUserProfiles(senderIds);

  const getListChatName = (chat: any) => {
    if (chat.isGlobal || chat.id === GLOBAL_CHAT_ID) return 'Global Chat';
    if (chat.id?.startsWith('zolbot__')) return 'Zolbot';
    if (chat.groupName) return chat.groupName;
    const other = Object.entries(chat.participantMeta || {}).find(([uid]) => uid !== user?.uid && uid !== 'zolbot');
    if (other) return liveProfiles[other[0]]?.username || (other[1] as any)?.username || 'User';
    return 'Chat';
  };

  const getListChatAvatar = (chat: any) => {
    if (chat.isGroup && chat.groupImage) return chat.groupImage;
    const other = Object.entries(chat.participantMeta || {}).find(([uid]) => uid !== user?.uid && uid !== 'zolbot');
    return other ? liveProfiles[other[0]]?.photoURL || (other[1] as any)?.photoURL || null : null;
  };

  const getListLastMessage = (chat: any) => {
    const senderId = chat.lastMessageSenderId;
    const prefix = senderId === user?.uid
      ? 'You'
      : senderId && (chat.isGroup || chat.isGlobal)
        ? liveProfiles[senderId]?.username || chat.participantMeta?.[senderId]?.username || 'User'
        : '';
    return prefix ? `${prefix}: ${chat.lastMessage || ''}` : chat.lastMessage || '';
  };

  const visibleChats = allChats.filter((chat) =>
    getListChatName(chat).toLowerCase().includes(chatListSearch.trim().toLowerCase())
  );

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isOwn = item.senderId === user?.uid;
    const isBotMsg = item.senderId === 'zolbot';
    const isPending = item.status === 'pending';
    const previousMessage = index > 0 ? filteredMessages[index - 1] : null;
    const showSenderName = !previousMessage || previousMessage.senderId !== item.senderId;

    const handleAvatarPress = async () => {
      if (!item.senderId) return;
      if (item.senderId === user?.uid) {
        setProfileSheetVisible(true);
        setProfileSheetUser(null);
        return;
      }
      if (item.senderId === 'zolbot') {
        setProfileSheetUser({ uid: 'zolbot', username: 'Zolbot', isBot: true, email: 'zolbot@zoldyck.ai' });
        setProfileSheetVisible(true);
        return;
      }

      const meta = chatData?.participantMeta?.[item.senderId];
      if (meta) {
        setProfileSheetUser({ uid: item.senderId, ...meta });
        setProfileSheetVisible(true);
        return;
      }

      // In global chats or groups where sender is not in participantMeta,
      // immediately display info from the message item and fetch the user doc in background
      const fallbackUser = {
        uid: item.senderId,
        username: item.senderUsername || 'User',
        email: item.senderEmail || '',
        photoURL: item.senderPhotoURL || null,
      };
      setProfileSheetUser(fallbackUser);
      setProfileSheetVisible(true);

      try {
        const uSnap = await getDoc(doc(db, 'users', item.senderId));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          setProfileSheetUser({
            uid: item.senderId,
            username: uData.username || item.senderUsername || 'User',
            email: uData.email || item.senderEmail || '',
            photoURL: uData.photoURL || item.senderPhotoURL || null,
          });
        }
      } catch {}
    };

    return (
      <Swipeable
        ref={(r) => {
          if (r) swipeableRefs.current.set(item.id, r);
          else swipeableRefs.current.delete(item.id);
        }}
        enabled={!isPending}
        renderLeftActions={renderReplyAction}
        onSwipeableWillOpen={() => closeOtherSwipeables(item.id)}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            setReplyingTo(item);
            swipeableRefs.current.get(item.id)?.close?.();
          }
        }}
        overshootLeft={false}
        friction={2}
        leftThreshold={40}
        failOffsetY={[-10, 10]}
      >
      <MessageBubble
        text={item.text || ''}
        senderName={getLiveUsername(item.senderId, item.senderUsername) || 'User'}
        showSenderName={showSenderName}
        senderPhotoURL={getProfileImageForSender(item.senderId, item.senderPhotoURL)}
        timestamp={isPending ? '' : formatTime(item.createdAt)}
        isOwn={isOwn}
        isBot={isBotMsg}
        isPending={isPending}
        isGroup={isGroup || isGlobal}
        senderColor={isBotMsg ? colors.primary : getMemberColor(item.senderId || item.senderUsername || 'user')}
        imageUrl={item.imageUrl}
        reactions={item.reactions}
        edited={item.edited}
        replyTo={
          item.replyTo
            ? {
                id: item.replyTo.id,
                text: item.replyTo.text || '',
                senderName: getLiveUsername(item.replyTo.senderId, item.replyTo.senderName) || 'User',
              }
            : null
        }
        highlighted={highlightId === item.id}
        currentUid={user?.uid}
        onReact={(emoji) => handleReact(item.id, emoji)}
        onPress={isPending ? undefined : () => setReactTarget(item)}
        onReplyPress={(reply) => jumpToMessage(reply.id)}
        onImagePress={(uri) => setImageViewerUri(uri)}
        onAvatarPress={handleAvatarPress}
        onLongPress={isPending ? undefined : () => setReactTarget(item)}
      />
      </Swipeable>
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
    if (profileSheetUser) return liveProfiles[profileSheetUser.uid]?.photoURL || profileSheetUser.photoURL || null;
    return getChatAvatar();
  };

  const getProfileSheetTitle = () => {
    if (profileSheetUser) return getLiveUsername(profileSheetUser.uid, profileSheetUser.username) || 'User';
    return getChatTitle();
  };

  const getProfileSheetIsBot = () => {
    if (profileSheetUser) return profileSheetUser.isBot === true;
    return isZolbot;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.chatWorkspace, desktop && styles.desktopWorkspace]}>
        {desktop && (
          <View style={[styles.primaryTabsPane, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
            <View style={styles.chatListPaneBrand}>
              <View style={[styles.chatListPaneBrandMark, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="forum" size={20} color="#FFFFFF" />
              </View>
              <Text style={[styles.chatListPaneBrandName, { color: colors.text }]}>ZolChat</Text>
            </View>
            <Text style={[styles.primaryTabsLabel, { color: colors.textTertiary }]}>WORKSPACE</Text>
            {([
              { title: 'Chats', icon: 'chat-bubble-outline', route: '/(tabs)' },
              { title: 'Search', icon: 'search', route: '/(tabs)/search' },
              { title: 'Profile', icon: 'person-outline', route: '/(tabs)/profile' },
            ] as const).map((tab) => (
              <TouchableOpacity
                key={tab.title}
                style={[styles.primaryTabItem, tab.title === 'Chats' && { backgroundColor: colors.primary + '18' }]}
                onPress={() => router.replace(tab.route)}
                activeOpacity={0.7}
              >
                <MaterialIcons name={tab.icon} size={21} color={tab.title === 'Chats' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.primaryTabText, { color: tab.title === 'Chats' ? colors.primary : colors.textSecondary }, tab.title === 'Chats' && styles.primaryTabTextActive]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {desktop && (
          <View style={[styles.chatListPane, { backgroundColor: colors.background, borderRightColor: colors.border }]}>
            <View style={styles.chatListPaneHeader}>
              <Text style={[styles.chatListPaneTitle, { color: colors.text }]}>Chats</Text>
            </View>
            <View style={styles.chatListPaneSearch}>
              <SearchBar value={chatListSearch} onChangeText={setChatListSearch} placeholder="Search conversations" />
            </View>
            <FlatList
              data={visibleChats}
              keyExtractor={(item) => item.id}
              style={styles.chatListPaneItems}
              contentContainerStyle={styles.chatListPaneContent}
              renderItem={({ item }) => (
                <ChatListItem
                  name={getListChatName(item)}
                  lastMessage={getListLastMessage(item)}
                  timestamp={formatTime(item.updatedAt)}
                  avatarUri={getListChatAvatar(item)}
                  isBot={item.id?.startsWith('zolbot__')}
                  isGlobal={item.isGlobal || item.id === GLOBAL_CHAT_ID}
                  isGroup={item.isGroup}
                  groupImage={item.groupImage}
                  active={item.id === chatId}
                  onAvatarPress={() => {
                    if (item.isGlobal || item.isGroup || item.id?.startsWith('zolbot__')) return;
                    const other = Object.entries(item.participantMeta || {}).find(([uid]) => uid !== user?.uid && uid !== 'zolbot');
                    if (!other) return;
                    const [uid, meta] = other as [string, any];
                    setProfileSheetUser({
                      uid,
                      ...meta,
                      username: liveProfiles[uid]?.username || meta.username || 'User',
                      photoURL: liveProfiles[uid]?.photoURL || meta.photoURL || null,
                    });
                    setProfileSheetVisible(true);
                  }}
                  onPress={() => {
                    if (item.id !== chatId) router.replace(`/chat/${item.id}`);
                  }}
                />
              )}
              ListEmptyComponent={(
                <Text style={[styles.chatListPaneEmpty, { color: colors.textTertiary }]}>No conversations found</Text>
              )}
            />
          </View>
        )}
      <KeyboardAvoidingView
        style={[styles.flex, desktop && styles.desktopChatPane]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setProfileSheetVisible(true)}
        >
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            {!desktop && (
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <MaterialIcons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}

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
              <View style={styles.searchIconSlot}>
                <MaterialIcons name="search" size={16} color={colors.textTertiary} />
              </View>
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
        <View style={[styles.messagesContainer, { backgroundColor: colors.background }]}>
          <FlatList
            ref={flatListRef}
            data={filteredMessages}
            keyExtractor={(item) => item.id || Math.random().toString()}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onScrollBeginDrag={() => { wasAtBottom.current = false; Keyboard.dismiss(); }}
            onScrollEndDrag={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
              wasAtBottom.current = isAtBottom;
            }}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
              }, 500);
            }}
            onContentSizeChange={() => {
              if (wasAtBottom.current) {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 0);
              }
            }}
            onLayout={() => {
              if (wasAtBottom.current) {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 0);
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

        {/* Reply preview */}
        {replyingTo && (
          <View style={[styles.editBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <MaterialIcons name="reply" size={18} color={colors.primary} />
            <View style={styles.editBarTextWrap}>
              <Text style={[styles.editBarLabel, { color: colors.primary }]}>
                {getLiveUsername(replyingTo.senderId, replyingTo.senderUsername) || 'User'}
              </Text>
              <Text style={[styles.editBarText, { color: colors.textSecondary }]} numberOfLines={1}>
                {replyingTo.text || '📷 Photo'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Editing banner */}
        {editingMessage && (
          <View style={[styles.editBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <MaterialIcons name="edit" size={18} color={colors.primary} />
            <View style={styles.editBarTextWrap}>
              <Text style={[styles.editBarLabel, { color: colors.primary }]}>Editing message</Text>
              <Text style={[styles.editBarText, { color: colors.textSecondary }]} numberOfLines={1}>
                {editingMessage.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setEditingMessage(null); setText(''); }}>
              <MaterialIcons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Message Input */}
        <MessageInput
          value={text}
          onChangeText={handleTextChange}
          onSend={editingMessage ? handleSaveEdit : handleSend}
          onImagePick={handleImageSend}
          sending={sending}
        />

        {/* Options Menu Modal */}
        <Modal visible={menuVisible} transparent animationType="slide">
          <View style={styles.sheetContainer}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => setMenuVisible(false)}
            />
            <View style={[styles.menuSheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.profileSheetHandle, { backgroundColor: colors.text }]} />

              {!isGlobal && (
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={handleClearChat}
                >
                  <MaterialIcons name="delete-sweep" size={22} color={colors.danger} />
                  <Text style={[styles.menuItemText, { color: colors.danger }]}>Clear Chat</Text>
                </TouchableOpacity>
              )}
              {isGroup && (
                <>
                  {canManageGroup && (
                    <TouchableOpacity
                      style={[styles.menuItem, { borderBottomColor: colors.border }]}
                      onPress={() => { setMenuVisible(false); setAddMemberVisible(true); }}
                    >
                      <MaterialIcons name="person-add" size={22} color={colors.primary} />
                      <Text style={[styles.menuItemText, { color: colors.text }]}>Add Members</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: colors.border }]}
                    onPress={handleLeaveGroup}
                  >
                    <MaterialIcons name="exit-to-app" size={22} color={colors.danger} />
                    <Text style={[styles.menuItemText, { color: colors.danger }]}>Leave Group</Text>
                  </TouchableOpacity>
                </>
              )}
              {!isGlobal && (
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteChat}>
                  <MaterialIcons name="delete-forever" size={22} color={colors.danger} />
                  <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>

        {/* Message Actions Modal */}
        <Modal visible={!!reactTarget} transparent animationType="slide">
          <View style={styles.sheetContainer}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => setReactTarget(null)}
            />
            <View style={[styles.menuSheet, { backgroundColor: colors.surface }]}>
              <View style={[styles.profileSheetHandle, { backgroundColor: colors.text }]} />
              <View style={styles.quickReactRow}>
                {QUICK_REACTIONS.map((emoji) => {
                  const mine = user?.uid ? reactTarget?.reactions?.[user.uid] === emoji : false;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[styles.quickReactBtn, mine && { backgroundColor: colors.primary + '20' }]}
                      onPress={() => handleReact(reactTarget.id, emoji)}
                    >
                      <Text style={styles.quickReactEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.menuItem, { borderBottomColor: colors.border }]}
                onPress={startReply}
              >
                <MaterialIcons name="reply" size={22} color={colors.textSecondary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>Reply</Text>
              </TouchableOpacity>
              {reactTarget?.senderId === user?.uid && reactTarget?.text ? (
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={startEdit}
                >
                  <MaterialIcons name="edit" size={22} color={colors.textSecondary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              {reactTarget?.senderId === user?.uid ? (
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={handleDeleteMessage}
                >
                  <MaterialIcons name="delete" size={22} color={colors.danger} />
                  <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              {reactTarget?.text ? (
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.border }]}
                  onPress={handleCopyMessage}
                >
                  <MaterialIcons name="content-copy" size={22} color={colors.textSecondary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Copy</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Profile Sheet Modal */}
        <Modal visible={profileSheetVisible} transparent animationType="slide">
          <View style={styles.sheetContainer}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => { setProfileSheetVisible(false); setProfileSheetUser(null); }}
            />
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

                {!profileSheetUser && isGlobal && (
                  <View style={[styles.profileInfoRow, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="public" size={20} color={colors.primary} />
                    <Text style={[styles.profileInfoText, { color: colors.text }]}>
                      Anyone in the app can send messages here
                    </Text>
                  </View>
                )}

                {!profileSheetUser && isGroup && chatData?.participants && (
                  <View style={styles.profileMembersSection}>
                    <Text style={[styles.profileMembersTitle, { color: colors.textSecondary }]}>
                      Members
                    </Text>
                    {getParticipants().map((member) => (
                      <TouchableOpacity
                        key={member.uid}
                        style={[styles.profileMemberRow, { borderBottomColor: colors.border }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (member.uid === user?.uid) {
                            setProfileSheetUser(null);
                          } else if (member.uid === 'zolbot') {
                            setProfileSheetUser({ uid: 'zolbot', username: 'Zolbot', isBot: true, email: 'zolbot@zoldyck.ai' });
                          } else {
                            setProfileSheetUser({
                              uid: member.uid,
                              username: member.username,
                              email: member.email,
                              photoURL: member.photoURL,
                            });
                          }
                        }}
                      >
                        <Avatar uri={liveProfiles[member.uid]?.photoURL || member.photoURL} size={36} isBot={member.isBot} />
                        <View style={styles.profileMemberInfo}>
                          <Text style={[styles.profileMemberName, { color: colors.text }]}>
                            {getLiveUsername(member.uid, member.username) || member.username}
                          </Text>
                          {chatData.groupAdmins?.includes(member.uid) && (
                            <Text style={[styles.profileMemberRole, { color: colors.primary }]}>
                              Admin
                            </Text>
                          )}
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Email row for individual user (when clicking an avatar/user in group, global, or 1v1) */}
                {(profileSheetUser?.email || (!profileSheetUser && !isGlobal && !isGroup && !isZolbot && getOtherUser()?.email)) ? (
                  <View style={[styles.profileInfoRow, { backgroundColor: colors.inputBackground }]}>
                    <MaterialIcons name="email" size={20} color={colors.textTertiary} />
                    <Text style={[styles.profileInfoText, { color: colors.text }]}>
                      {profileSheetUser?.email || getOtherUser()?.email}
                    </Text>
                  </View>
                ) : null}

                {/* Direct message button if viewing another user from group or global */}
                {profileSheetUser && profileSheetUser.uid !== user?.uid && !profileSheetUser.isBot && (isGroup || isGlobal) && (
                  <TouchableOpacity
                    style={[styles.startChatButton, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      setProfileSheetVisible(false);
                      try {
                        const { startOrOpenChat } = await import('../../src/services/chatService');
                        const targetUser = {
                          uid: profileSheetUser.uid,
                          username: profileSheetUser.username,
                          email: profileSheetUser.email,
                          photoURL: profileSheetUser.photoURL,
                        };
                        const activeProfile = userProfile || {
                          uid: user?.uid || '',
                          email: user?.email || '',
                          username: user?.displayName || user?.email?.split('@')[0] || 'User',
                          photoURL: user?.photoURL || '',
                        };
                        const directChatId = await startOrOpenChat(activeProfile, targetUser);
                        router.push(`/chat/${directChatId}`);
                      } catch (err: any) {
                        Alert.alert('Error', err.message || 'Could not open chat');
                      }
                    }}
                  >
                    <MaterialIcons name="chat" size={18} color="#FFF" />
                    <Text style={styles.startChatButtonText}>Message {profileSheetUser.username}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Members Modal */}
        <Modal visible={addMemberVisible} transparent animationType="slide">
          <View style={styles.sheetContainer}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => { setAddMemberVisible(false); setMemberSearch(''); }}
            />
            <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
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
              </View>
            </SafeAreaView>
          </View>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatWorkspace: {
    flex: 1,
  },
  desktopWorkspace: {
    flexDirection: 'row',
    minWidth: 0,
  },
  primaryTabsPane: {
    width: 248,
    paddingHorizontal: 18,
    paddingTop: 24,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  chatListPaneBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 42,
  },
  chatListPaneBrandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatListPaneBrandName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  primaryTabsLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  primaryTabItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 13,
    gap: 13,
    marginBottom: 6,
  },
  primaryTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryTabTextActive: {
    fontWeight: '700',
  },
  chatListPane: {
    width: 320,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  chatListPaneHeader: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 16,
  },
  chatListPaneTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chatListPaneSearch: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  chatListPaneItems: {
    flex: 1,
  },
  chatListPaneContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  chatListPaneEmpty: {
    textAlign: 'center',
    padding: 24,
    fontSize: 14,
  },
  desktopChatPane: {
    minWidth: 0,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
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
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchIconSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    padding: 0,
    textAlignVertical: 'center',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 14,
    flexGrow: 1,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
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
  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  editBarTextWrap: {
    flex: 1,
  },
  editBarLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  editBarText: {
    fontSize: 14,
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
  quickReactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quickReactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickReactEmoji: {
    fontSize: 26,
  },
  swipeAction: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  startChatButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
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
