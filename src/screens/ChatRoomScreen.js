import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, IconButton, ActivityIndicator, Button, Checkbox, List, Modal, Portal, Searchbar, Surface, Text, TextInput } from 'react-native-paper';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOnline } from '../context/OnlineContext';
import { clearPresence, deleteMessage, forwardMessage, markChatAsRead, sendImageMessage, sendMessage, setTyping, subscribeToMessages, subscribeToPresence, GLOBAL_CHAT_ID, purgeOldGlobalMessages, clearChatMessages, addGroupMembers, toggleGroupAdmin, leaveGroup, toggleMessageReaction } from '../services/chatService';
import { uploadToCloudinary } from '../services/cloudinaryService';
import EmojiPicker from '../components/EmojiPicker';
import { showAlert } from '../components/AppAlert';

const senderObjFromProfile = (profile, user) => ({
  uid: profile?.uid || user?.uid,
  email: profile?.email || user?.email,
  username: profile?.username || user?.displayName || (user?.email ? user.email.split('@')[0] : 'User'),
  photoURL: profile?.photoURL || user?.photoURL || '',
});

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥', '🚀'];
const STARTER_CHIPS = ['Hey there! 👋', "How's it going?", 'What are you working on?'];

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
  const { colors, scaleFont } = useTheme();
  const { isOnline } = useOnline();
  const styles = useMemo(() => createStyles(colors, scaleFont), [colors, scaleFont]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [partnerPresence, setPartnerPresence] = useState(null);
  const [botCooldown, setBotCooldown] = useState(false);
  const [loadingImages, setLoadingImages] = useState({});
  const [showForward, setShowForward] = useState(false);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [forwardItems, setForwardItems] = useState([]);
  const [chatList, setChatList] = useState([]);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showChatMenuSheet, setShowChatMenuSheet] = useState(false);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [availableContactsToAdd, setAvailableContactsToAdd] = useState([]);
  const [selectedNewMemberUids, setSelectedNewMemberUids] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [groupDocData, setGroupDocData] = useState(null);

  // New UI/UX features state
  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [lightboxUri, setLightboxUri] = useState(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [reactionMsgItem, setReactionMsgItem] = useState(null);

  const [infoBar, setInfoBar] = useState(null);
  const infoBarTimeout = useRef(null);
  const infoBarAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const botCooldownRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const currentUid = user?.uid || profile?.uid;
  const isGroup = target?.isGroup || chatId.startsWith('group_');
  const isGlobal = target?.isGlobal || chatId === GLOBAL_CHAT_ID;

  // Load group doc if group
  useEffect(() => {
    if (isGroup) {
      getDoc(doc(db, 'chats', chatId)).then((snap) => {
        if (snap.exists()) setGroupDocData(snap.data());
      }).catch(() => {});
    }
  }, [isGroup, chatId, showChatMenuSheet, showGroupMembersModal, showAddMembersModal]);

  const isAdmin = useMemo(() => {
    if (!isGroup) return false;
    const admins = groupDocData?.groupAdmins || target?.groupAdmins || [];
    return admins.includes(currentUid);
  }, [isGroup, groupDocData, target, currentUid]);

  const toggleSelect = (item) => {
    setSelectedMessages((prev) => {
      const exists = prev.find((m) => m.id === item.id);
      if (exists) return prev.filter((m) => m.id !== item.id);
      return [...prev, item];
    });
  };

  const clearSelection = () => setSelectedMessages([]);

  const showInfoBar = (sender, time) => {
    if (infoBarTimeout.current) clearTimeout(infoBarTimeout.current);
    setInfoBar({ sender, time });
    infoBarAnim.setValue(0);
    Animated.timing(infoBarAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    infoBarTimeout.current = setTimeout(() => {
      Animated.timing(infoBarAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setInfoBar(null));
    }, 3000);
  };

  // In-chat search matching indices
  const matchingMsgIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const term = searchQuery.toLowerCase();
    const indices = [];
    messages.forEach((m, i) => {
      if (m.text && m.text.toLowerCase().includes(term)) {
        indices.push(i);
      }
    });
    return indices;
  }, [messages, searchQuery]);

  const scrollToMatch = (idx) => {
    if (matchingMsgIndices.length > 0 && idx >= 0 && idx < matchingMsgIndices.length) {
      setCurrentMatchIdx(idx);
      const msgIndex = matchingMsgIndices[idx];
      listRef.current?.scrollToIndex({ index: msgIndex, animated: true, viewPosition: 0.5 });
    }
  };

  useEffect(() => {
    const isTyping = partnerPresence && Object.values(partnerPresence).some((p) => p.typing);
    if (selectedMessages.length > 0) {
      const allMine = selectedMessages.every((m) => m.senderId === currentUid);
      const hasText = selectedMessages.some((m) => m.text);
      navigation.setOptions({
        headerTitle: () => (
          <Text style={[styles.headerSelectedTitle, { color: colors.onSurface }]}>{selectedMessages.length} selected</Text>
        ),
        headerLeft: () => (
          <IconButton icon="close" iconColor={colors.onSurface} size={24} onPress={clearSelection} />
        ),
        headerRight: () => (
          <View style={styles.headerActions}>
            {hasText ? (
              <IconButton icon="content-copy" iconColor={colors.onSurface} size={22} onPress={() => {
                const text = selectedMessages.filter((m) => m.text).map((m) => m.text).join('\n');
                Clipboard.setStringAsync(text);
                clearSelection();
              }} />
            ) : null}
            {selectedMessages.length === 1 ? (
              <IconButton icon="information-outline" iconColor={colors.onSurface} size={22} onPress={() => {
                const msg = selectedMessages[0];
                const ts = msg.createdAt;
                let dateStr = 'Unknown';
                if (ts?.toDate) dateStr = ts.toDate().toLocaleString();
                else if (ts?.seconds != null) dateStr = new Date(ts.seconds * 1000).toLocaleString();
                else if (ts) dateStr = new Date(ts).toLocaleString();
                showInfoBar(msg.senderUsername || 'Unknown', dateStr);
                clearSelection();
              }} />
            ) : null}
            {selectedMessages.length >= 1 ? (
              <IconButton icon="share-outline" iconColor={colors.onSurface} size={22} onPress={() => { startForward(selectedMessages); clearSelection(); }} />
            ) : null}
            {allMine ? (
              <IconButton icon="delete-outline" iconColor={colors.danger} size={22} onPress={() => {
                selectedMessages.forEach((m) => {
                  deleteMessage(chatId, m.id).catch(() => {});
                });
                clearSelection();
              }} />
            ) : null}
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        headerTitle: () => (
          <Pressable onPress={() => setShowProfileSheet(true)} style={styles.headerTitleContainer}>
            {target?.uid === 'zolbot' ? (
              <Avatar.Image source={require('../../assets/zolbot.jpg')} size={34} />
            ) : isGlobal ? (
              <Avatar.Text
                size={34}
                label="🌍"
                style={[styles.headerAvatarBg, { backgroundColor: colors.primary + '30' }]}
                labelStyle={{ fontSize: 18 }}
              />
            ) : isGroup ? (
              <Avatar.Text
                size={34}
                label={(target?.username || target?.groupName || 'GP').slice(0, 2).toUpperCase()}
                style={[styles.headerAvatarBg, { backgroundColor: colors.secondary + '30' }]}
                labelStyle={{ fontSize: 16, color: colors.secondary, fontWeight: 'bold' }}
              />
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
              <Text
                style={[
                  styles.headerName,
                  target?.uid === 'zolbot' && { color: colors.primary, fontStyle: 'italic' },
                  isGlobal && { color: '#4CAF50', fontWeight: '800' },
                  isGroup && { color: colors.secondary, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {target?.groupName || target?.username || target?.email || 'Unknown'}
              </Text>
              <Text style={styles.headerEmail} numberOfLines={1}>
                {isTyping
                  ? 'typing...'
                  : isGlobal
                  ? 'Messages auto-delete after 72h ⏳'
                  : isGroup
                  ? `${(groupDocData?.participants || target?.participants || []).length} members`
                  : target?.email || ''}
              </Text>
            </View>
          </Pressable>
        ),
        headerLeft: undefined,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="magnify"
              iconColor={showInChatSearch ? colors.primary : colors.onSurface}
              size={22}
              onPress={() => setShowInChatSearch((prev) => !prev)}
            />
            <IconButton
              icon="dots-vertical"
              iconColor={colors.onSurface}
              size={22}
              onPress={() => setShowChatMenuSheet(true)}
            />
          </View>
        ),
      });
    }
  }, [navigation, target, partnerPresence, selectedMessages, user, profile, colors, isGroup, isGlobal, groupDocData, showInChatSearch]);

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
    if (!uid || target?.uid === 'zolbot' || target?.isGlobal) return;
    const unsubscribe = subscribeToPresence(chatId, uid, setPartnerPresence);
    return unsubscribe;
  }, [chatId, profile?.uid, user?.uid, target?.uid, target?.isGlobal]);

  useEffect(() => {
    return () => {
      const uid = profile?.uid || user?.uid;
      if (uid && target?.uid !== 'zolbot' && !target?.isGlobal) {
        setTyping(chatId, uid, false);
        clearPresence(chatId, uid);
      }
      if (botCooldownRef.current) clearTimeout(botCooldownRef.current);
    };
  }, [chatId, profile?.uid, user?.uid, target?.uid]);

  const onTextChange = (value) => {
    setText(value);
    const uid = profile?.uid || user?.uid;
    if (!uid || target?.uid === 'zolbot' || target?.isGlobal) return;
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
      showAlert('Please wait', 'Zolbot is still thinking. Try again in a few seconds.', [{ text: 'OK' }]);
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
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to send message. Please try again.', [{ text: 'OK' }]);
    } finally {
      setSending(false);
    }
  };

  const onSendImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permission needed', 'Please allow photo access to share images.', [{ text: 'OK' }]);
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
      showAlert('Error', 'Failed to send image. Please try again.', [{ text: 'OK' }]);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = () => {
    setShowChatMenuSheet(false);
    showAlert(
      'Clear Chat',
      'Are you sure you want to clear all messages in this conversation? All messages will be permanently deleted from the database.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearChatMessages(chatId);
              showAlert('Success', 'Chat history cleared.', [{ text: 'OK' }]);
            } catch {
              showAlert('Error', 'Failed to clear chat.', [{ text: 'OK' }]);
            }
          },
        },
      ],
    );
  };

  const handleOpenAddMembers = async () => {
    setShowChatMenuSheet(false);
    setSelectedNewMemberUids([]);
    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', currentUid));
      const snapshot = await getDocs(q);
      const existingParticipants = groupDocData?.participants || target?.participants || [];
      const contactsMap = new Map();

      if (!existingParticipants.includes('zolbot')) {
        contactsMap.set('zolbot', {
          uid: 'zolbot',
          username: 'Zolbot 🤖',
          email: 'zolbot@zoldyck.ai',
        });
      }

      snapshot.docs.forEach((docSnap) => {
        const cData = docSnap.data();
        if (!cData.isGroup && !cData.isGlobal) {
          const partnerId = cData.participants?.find((p) => p !== currentUid);
          if (partnerId && !existingParticipants.includes(partnerId)) {
            const meta = cData.participantMeta?.[partnerId] || {};
            contactsMap.set(partnerId, {
              uid: partnerId,
              username: meta.username || meta.email || 'User',
              email: meta.email || '',
              photoURL: meta.photoURL || '',
            });
          }
        }
      });

      setAvailableContactsToAdd(Array.from(contactsMap.values()));
      setShowAddMembersModal(true);
    } catch {
      showAlert('Error', 'Could not load contacts to add.', [{ text: 'OK' }]);
    }
  };

  const handleConfirmAddMembers = async () => {
    if (selectedNewMemberUids.length === 0) return;
    setAddingMembers(true);
    try {
      await addGroupMembers(chatId, selectedNewMemberUids);
      setShowAddMembersModal(false);
      setSelectedNewMemberUids([]);
      showAlert('Success', 'Members added to group.', [{ text: 'OK' }]);
    } catch {
      showAlert('Error', 'Failed to add members.', [{ text: 'OK' }]);
    } finally {
      setAddingMembers(false);
    }
  };

  const handleLeaveGroup = () => {
    setShowChatMenuSheet(false);
    showAlert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(chatId, currentUid);
              navigation.goBack();
            } catch {
              showAlert('Error', 'Failed to leave group.', [{ text: 'OK' }]);
            }
          },
        },
      ],
    );
  };

  const startForward = async (items) => {
    setForwardItems(Array.isArray(items) ? items : [items]);
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
    if (!forwardTarget || !forwardItems.length) return;
    try {
      const senderObj = senderObjFromProfile(profile, user);
      for (const item of forwardItems) {
        await forwardMessage(forwardTarget.id, senderObj, item.text, item.imageUrl);
      }
      const partnerId = forwardTarget.participants?.find((p) => p !== (user?.uid || profile?.uid));
      const partnerName = forwardTarget.participantMeta?.[partnerId]?.username || 'chat';
      showAlert('Sent', `${forwardItems.length} message${forwardItems.length > 1 ? 's' : ''} forwarded to ${partnerName}.`, [{ text: 'OK' }]);
    } catch {
      showAlert('Error', 'Failed to forward message.', [{ text: 'OK' }]);
    } finally {
      setShowForward(false);
      setForwardTarget(null);
      setForwardItems([]);
    }
  };



  const onLongPressMessage = (item) => {
    if (selectedMessages.length > 0) {
      toggleSelect(item);
    } else {
      setReactionMsgItem(item);
    }
  };

  const renderStatusBadge = (item) => {
    if (item.senderId !== currentUid) return null;
    let code = 'S';
    let badgeColor = '#9E9E9E';

    if (item.status === 'read') {
      code = 'R';
      badgeColor = '#4CAF50';
    }

    return (
      <Text style={[styles.receiptText, { color: badgeColor }]}>
        {code}
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      {isGlobal && (
        <Surface style={styles.globalNoticeBanner} elevation={1}>
          <Text style={styles.globalNoticeText}>
            ⏳ Messages in Global Chat automatically delete after 72 hours.
          </Text>
        </Surface>
      )}

      {showInChatSearch && (
        <Surface style={styles.inChatSearchContainer} elevation={2}>
          <Searchbar
            placeholder="Search in chat..."
            value={searchQuery}
            onChangeText={(v) => { setSearchQuery(v); setCurrentMatchIdx(0); }}
            style={styles.inChatSearchInput}
            placeholderTextColor={colors.muted}
            iconColor={colors.muted}
            textColor={colors.onSurface}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {matchingMsgIndices.length > 0 ? `${currentMatchIdx + 1}/${matchingMsgIndices.length}` : '0'}
            </Text>
            <IconButton
              icon="chevron-up"
              size={18}
              disabled={matchingMsgIndices.length === 0}
              onPress={() => scrollToMatch((currentMatchIdx - 1 + matchingMsgIndices.length) % matchingMsgIndices.length)}
            />
            <IconButton
              icon="chevron-down"
              size={18}
              disabled={matchingMsgIndices.length === 0}
              onPress={() => scrollToMatch((currentMatchIdx + 1) % matchingMsgIndices.length)}
            />
            <IconButton
              icon="close"
              size={18}
              onPress={() => { setShowInChatSearch(false); setSearchQuery(''); }}
            />
          </View>
        </Surface>
      )}

      {messages.length === 0 ? (
        <View style={styles.emptyWelcomeContainer}>
          <Avatar.Icon size={64} icon="chat-outline" style={{ backgroundColor: colors.primary + '20' }} color={colors.primary} />
          <Text style={styles.emptyWelcomeTitle}>
            Say hello to {target?.username || target?.groupName || 'this chat'} 👋
          </Text>
          <Text style={styles.emptyWelcomeSubtitle}>Start a private conversation or send a quick starter below:</Text>
          <View style={styles.starterChipsContainer}>
            {STARTER_CHIPS.map((chip, idx) => (
              <Pressable
                key={idx}
                style={[styles.starterChip, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  sendMessage(chatId, profile || user, chip);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const mine = item.senderId === currentUid;
            const isMatch = matchingMsgIndices.includes(index);
            const reactionsMap = item.reactions || {};
            const groupedReactionsMap = {};
            Object.values(reactionsMap).forEach((emoji) => {
              groupedReactionsMap[emoji] = (groupedReactionsMap[emoji] || 0) + 1;
            });
            const groupedReactions = Object.entries(groupedReactionsMap);

            return (
              <View style={{ marginVertical: 4 }}>
                <Pressable
                  onLongPress={() => onLongPressMessage(item)}
                  onPress={() => { if (selectedMessages.length > 0) toggleSelect(item); }}
                  style={[
                    styles.bubble,
                    mine ? styles.mine : styles.theirs,
                    selectedMessages.some((m) => m.id === item.id) && styles.selectedBubble,
                    isMatch && { borderWidth: 2, borderColor: '#FF9800' },
                  ]}
                >
                  {item.imageUrl ? (
                    <Pressable style={styles.imageContainer} onPress={() => setLightboxUri(item.imageUrl)}>
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
                    </Pressable>
                  ) : null}
                  {item.text ? (
                    <LinkableText text={item.text} style={mine ? styles.mineText : styles.theirsText} />
                  ) : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 4 }}>
                    <Text style={[styles.timeText, mine ? styles.mineTime : styles.theirsTime]}>
                      {formatTime(item.createdAt)}
                    </Text>
                    {mine ? renderStatusBadge(item) : null}
                  </View>
                </Pressable>

                {/* Reaction Badges */}
                {groupedReactions.length > 0 && (
                  <View style={[styles.reactionsRow, mine ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
                    {groupedReactions.map(([emoji, count]) => (
                      <Pressable
                        key={emoji}
                        style={[styles.reactionBadge, { backgroundColor: colors.surfaceVariant }]}
                        onPress={() => toggleMessageReaction(chatId, item.id, currentUid, emoji)}
                      >
                        <Text style={{ fontSize: 12, color: colors.onSurface }}>{emoji} {count > 1 ? count : ''}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

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
          placeholder={botCooldown ? 'Zolbot is thinking...' : isGlobal ? 'Message everyone...' : 'Message...'}
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
        {/* 3-Dot Options Bottom Sheet */}
        {showChatMenuSheet && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={() => setShowChatMenuSheet(false)} />
            <Surface style={styles.menuSheet} elevation={5}>
              <View style={styles.sheetHandle} />
              <Text style={styles.menuSheetTitle}>
                {isGroup ? (target?.groupName || 'Group Options') : (target?.username || target?.email || 'Chat Options')}
              </Text>

              {isGlobal ? (
                <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 12, fontSize: 13 }}>
                  Global Chat: All messages are public and auto-delete after 72 hours.
                </Text>
              ) : null}

              {isGroup ? (
                <>
                  <List.Item
                    title="View Members"
                    left={(props) => <List.Icon {...props} icon="account-group-outline" color={colors.onSurface} />}
                    onPress={() => { setShowChatMenuSheet(false); setShowGroupMembersModal(true); }}
                    titleStyle={{ color: colors.onSurface }}
                  />
                  {isAdmin ? (
                    <List.Item
                      title="Add Members"
                      left={(props) => <List.Icon {...props} icon="account-plus-outline" color={colors.primary} />}
                      onPress={handleOpenAddMembers}
                      titleStyle={{ color: colors.primary, fontWeight: '600' }}
                    />
                  ) : null}
                  <List.Item
                    title="Clear Chat"
                    left={(props) => <List.Icon {...props} icon="broom" color={colors.danger} />}
                    onPress={handleClearChat}
                    titleStyle={{ color: colors.danger, fontWeight: '600' }}
                  />
                  <List.Item
                    title="Leave Group"
                    left={(props) => <List.Icon {...props} icon="exit-to-app" color={colors.danger} />}
                    onPress={handleLeaveGroup}
                    titleStyle={{ color: colors.danger, fontWeight: '600' }}
                  />
                </>
              ) : (
                <List.Item
                  title="Clear Chat"
                  left={(props) => <List.Icon {...props} icon="broom" color={colors.danger} />}
                  onPress={handleClearChat}
                  titleStyle={{ color: colors.danger, fontWeight: '600' }}
                />
              )}

              <Button
                mode="outlined"
                onPress={() => setShowChatMenuSheet(false)}
                style={{ marginTop: 12, borderRadius: 12, borderColor: colors.surfaceVariant }}
                textColor={colors.onSurface}
              >
                Close
              </Button>
            </Surface>
          </KeyboardAvoidingView>
        )}

        {/* View Group Members Modal */}
        {showGroupMembersModal && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={() => setShowGroupMembersModal(false)} />
            <Surface style={[styles.menuSheet, { maxHeight: '80%' }]} elevation={5}>
              <View style={styles.sheetHandle} />
              <Text style={styles.menuSheetTitle}>Group Members</Text>
              <FlatList
                data={groupDocData?.participants || target?.participants || []}
                keyExtractor={(item) => item}
                style={{ maxHeight: 280, marginTop: 8 }}
                renderItem={({ item: memberUid }) => {
                  const meta = groupDocData?.participantMeta?.[memberUid] || target?.participantMeta?.[memberUid] || {};
                  const isMemberAdmin = (groupDocData?.groupAdmins || target?.groupAdmins || []).includes(memberUid);
                  return (
                    <List.Item
                      title={meta.username || meta.email || (memberUid === 'zolbot' ? 'Zolbot 🤖' : 'User')}
                      description={isMemberAdmin ? 'Admin' : 'Member'}
                      titleStyle={{ color: colors.onSurface, fontWeight: '600' }}
                      descriptionStyle={{ color: isMemberAdmin ? colors.primary : colors.muted }}
                      left={() => (
                        <View style={{ justifyContent: 'center', marginRight: 8 }}>
                          {memberUid === 'zolbot' ? (
                            <Avatar.Image source={require('../../assets/zolbot.jpg')} size={36} />
                          ) : meta.photoURL ? (
                            <Avatar.Image source={{ uri: meta.photoURL }} size={36} />
                          ) : (
                            <Avatar.Text
                              size={36}
                              label={(meta.username || '?').slice(0, 2).toUpperCase()}
                              style={{ backgroundColor: colors.surfaceVariant }}
                              labelStyle={{ fontSize: 14, color: colors.primary }}
                            />
                          )}
                        </View>
                      )}
                      right={() => (
                        isAdmin && memberUid !== currentUid && memberUid !== 'zolbot' ? (
                          <Button
                            mode="text"
                            onPress={() => toggleGroupAdmin(chatId, memberUid, !isMemberAdmin)}
                            textColor={isMemberAdmin ? colors.danger : colors.primary}
                            labelStyle={{ fontSize: 12 }}
                          >
                            {isMemberAdmin ? 'Remove Admin' : 'Make Admin'}
                          </Button>
                        ) : null
                      )}
                    />
                  );
                }}
              />
              <Button
                mode="contained"
                onPress={() => setShowGroupMembersModal(false)}
                style={{ borderRadius: 12, marginTop: 12, backgroundColor: colors.primary }}
              >
                Close
              </Button>
            </Surface>
          </KeyboardAvoidingView>
        )}

        {/* Add Members Modal */}
        {showAddMembersModal && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <Pressable style={styles.backdrop} onPress={() => setShowAddMembersModal(false)} />
            <Surface style={[styles.menuSheet, { maxHeight: '80%' }]} elevation={5}>
              <View style={styles.sheetHandle} />
              <Text style={styles.menuSheetTitle}>Add Members to Group</Text>
              <FlatList
                data={availableContactsToAdd}
                keyExtractor={(item) => item.uid}
                style={{ maxHeight: 260, marginTop: 8 }}
                ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 16 }}>No contacts available to add.</Text>}
                renderItem={({ item }) => {
                  const selected = selectedNewMemberUids.includes(item.uid);
                  return (
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: selected ? colors.primary + '20' : undefined }}
                      onPress={() => {
                        setSelectedNewMemberUids((prev) =>
                          prev.includes(item.uid) ? prev.filter((id) => id !== item.uid) : [...prev, item.uid]
                        );
                      }}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {item.uid === 'zolbot' ? (
                          <Avatar.Image source={require('../../assets/zolbot.jpg')} size={36} />
                        ) : item.photoURL ? (
                          <Avatar.Image source={{ uri: item.photoURL }} size={36} />
                        ) : (
                          <Avatar.Text
                            size={36}
                            label={(item.username || '?').slice(0, 2).toUpperCase()}
                            style={{ backgroundColor: colors.surfaceVariant }}
                            labelStyle={{ fontSize: 14, color: colors.primary }}
                          />
                        )}
                        <View>
                          <Text style={{ color: colors.onSurface, fontWeight: '600' }}>{item.username}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{item.email}</Text>
                        </View>
                      </View>
                      <Checkbox.Android
                        status={selected ? 'checked' : 'unchecked'}
                        color={colors.primary}
                        onPress={() => {
                          setSelectedNewMemberUids((prev) =>
                            prev.includes(item.uid) ? prev.filter((id) => id !== item.uid) : [...prev, item.uid]
                          );
                        }}
                      />
                    </Pressable>
                  );
                }}
              />
              <Button
                mode="contained"
                onPress={handleConfirmAddMembers}
                loading={addingMembers}
                disabled={addingMembers || selectedNewMemberUids.length === 0}
                style={{ borderRadius: 12, marginTop: 12, backgroundColor: colors.primary }}
              >
                Add Selected ({selectedNewMemberUids.length})
              </Button>
            </Surface>
          </KeyboardAvoidingView>
        )}

        <Modal visible={showForward} onDismiss={() => { setShowForward(false); setForwardTarget(null); setForwardItems([]); }} contentContainerStyle={styles.forwardModal}>
          <Text style={styles.forwardTitle}>Forward {forwardItems.length > 1 ? `${forwardItems.length} messages` : 'message'} to...</Text>
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
            disabled={!forwardTarget || !forwardItems.length}
            containerColor={colors.primary}
            iconColor={colors.background}
            style={styles.forwardSendBtn}
          />
        </Modal>

        {/* Fullscreen Image Lightbox */}
        {Boolean(lightboxUri) && (
          <Modal visible={Boolean(lightboxUri)} onDismiss={() => setLightboxUri(null)} contentContainerStyle={styles.lightboxContainer}>
            <Pressable style={styles.lightboxBackdrop} onPress={() => setLightboxUri(null)}>
              <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
              <View style={[styles.lightboxHeaderActions, { top: insets.top + 10 }]}>
                <IconButton icon="close" iconColor="#FFFFFF" size={28} onPress={() => setLightboxUri(null)} />
              </View>
            </Pressable>
          </Modal>
        )}

        {/* Profile Details Sheet */}
        {showProfileSheet && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={() => setShowProfileSheet(false)} />
            <Surface style={styles.profileSheet} elevation={5}>
              <View style={styles.sheetHandle} />
              <View style={{ alignItems: 'center', marginVertical: 12, gap: 8 }}>
                {target?.uid === 'zolbot' ? (
                  <Avatar.Image source={require('../../assets/zolbot.jpg')} size={90} />
                ) : isGlobal ? (
                  <Avatar.Text size={90} label="🌍" style={{ backgroundColor: colors.primary + '30' }} labelStyle={{ fontSize: 44 }} />
                ) : isGroup ? (
                  <Avatar.Text size={90} label={(target?.username || target?.groupName || 'GP').slice(0, 2).toUpperCase()} style={{ backgroundColor: colors.secondary + '30' }} labelStyle={{ fontSize: 36, color: colors.secondary, fontWeight: 'bold' }} />
                ) : target?.photoURL ? (
                  <Avatar.Image source={{ uri: target.photoURL }} size={90} />
                ) : (
                  <Avatar.Text size={90} label={(target?.username || target?.email || '?').slice(0, 2).toUpperCase()} style={{ backgroundColor: colors.surfaceVariant }} labelStyle={{ fontSize: 32, color: colors.primary }} />
                )}
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.onSurface }}>
                  {target?.groupName || target?.username || target?.email || 'Unknown User'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {isGlobal ? 'Public Global Chat' : isGroup ? `${(groupDocData?.participants || target?.participants || []).length} members` : target?.email || ''}
                </Text>
                {!isGroup && !isGlobal && target?.uid !== 'zolbot' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnline(target?.uid) ? '#4CAF50' : colors.muted }} />
                    <Text style={{ fontSize: 12, color: isOnline(target?.uid) ? '#4CAF50' : colors.muted, fontWeight: '600' }}>
                      {isOnline(target?.uid) ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                )}
              </View>

              <Button mode="contained" onPress={() => setShowProfileSheet(false)} style={{ borderRadius: 12, marginTop: 12, backgroundColor: colors.primary }}>
                Close
              </Button>
            </Surface>
          </KeyboardAvoidingView>
        )}

        {/* Quick Reaction Popover Sheet */}
        {reactionMsgItem && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={() => setReactionMsgItem(null)} />
            <Surface style={styles.reactionPopoverSheet} elevation={5}>
              <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12, marginBottom: 8 }}>React to message:</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
                {QUICK_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      toggleMessageReaction(chatId, reactionMsgItem.id, currentUid, emoji);
                      setReactionMsgItem(null);
                    }}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ fontSize: 28 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: colors.surfaceVariant, marginVertical: 8 }} />
              <List.Item
                title="Select Messages"
                left={(props) => <List.Icon {...props} icon="selection-drag" color={colors.primary} />}
                onPress={() => {
                  setSelectedMessages([reactionMsgItem]);
                  setReactionMsgItem(null);
                }}
                titleStyle={{ color: colors.primary, fontWeight: '600' }}
              />
              <List.Item
                title="Copy Text"
                left={(props) => <List.Icon {...props} icon="content-copy" color={colors.onSurface} />}
                onPress={() => {
                  if (reactionMsgItem.text) Clipboard.setStringAsync(reactionMsgItem.text);
                  setReactionMsgItem(null);
                }}
                titleStyle={{ color: colors.onSurface }}
              />
              <List.Item
                title="Forward Message"
                left={(props) => <List.Icon {...props} icon="share-outline" color={colors.onSurface} />}
                onPress={() => {
                  startForward(reactionMsgItem);
                  setReactionMsgItem(null);
                }}
                titleStyle={{ color: colors.onSurface }}
              />
              {reactionMsgItem.senderId === currentUid && (
                <List.Item
                  title="Delete Message"
                  left={(props) => <List.Icon {...props} icon="delete-outline" color={colors.danger} />}
                  onPress={() => {
                    deleteMessage(chatId, reactionMsgItem.id).catch(() => {});
                    setReactionMsgItem(null);
                  }}
                  titleStyle={{ color: colors.danger, fontWeight: '600' }}
                />
              )}
            </Surface>
          </KeyboardAvoidingView>
        )}
      </Portal>

      {infoBar && (
        <Animated.View style={[styles.infoBar, { backgroundColor: colors.surfaceVariant, opacity: infoBarAnim, bottom: Math.max(insets.bottom, 12) + 60 }]}>
          <Text style={[styles.infoBarTitle, { color: colors.onSurface }]}>{infoBar.sender}</Text>
          <Text style={[styles.infoBarTime, { color: colors.muted }]}>{infoBar.time}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (c, sf) => StyleSheet.create({
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
    fontSize: sf(15),
  },
  headerEmail: {
    color: c.muted,
    fontSize: sf(11),
    maxWidth: 200,
  },
  headerSelectedTitle: {
    fontSize: sf(17),
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  infoBarTitle: {
    fontSize: sf(14),
    fontWeight: '600',
    marginBottom: 2,
  },
  infoBarTime: {
    fontSize: sf(12),
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  bubble: {
    maxWidth: '75%',
    marginVertical: 4,
    paddingTop: 10,
    paddingBottom: 4,
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
  },
  mineText: {
    color: c.white,
    fontSize: sf(15),
    lineHeight: sf(20),
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: c.chatTheirs,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  theirsText: {
    color: c.onSurface,
    fontSize: sf(15),
    lineHeight: sf(20),
  },
  selectedBubble: {
    borderWidth: 2,
    borderColor: c.primary,
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
    fontSize: sf(9),
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
    fontSize: sf(18),
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  forwardEmpty: {
    color: c.muted,
    fontSize: sf(14),
    textAlign: 'center',
    marginTop: 24,
  },
  forwardSendBtn: {
    alignSelf: 'center',
    marginTop: 8,
  },
  globalNoticeBanner: {
    backgroundColor: c.surfaceVariant,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
    alignItems: 'center',
  },
  globalNoticeText: {
    color: '#4CAF50',
    fontSize: sf(12),
    fontWeight: '600',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  menuSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.surfaceVariant,
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuSheetTitle: {
    color: c.onSurface,
    fontSize: sf(17),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  receiptText: {
    fontSize: sf(10),
    fontWeight: '800',
    marginLeft: 2,
  },
  inChatSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceVariant,
  },
  inChatSearchInput: {
    flex: 1,
    height: 38,
    backgroundColor: c.background,
    borderRadius: 12,
  },
  emptyWelcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyWelcomeTitle: {
    fontSize: sf(18),
    fontWeight: '700',
    color: c.onSurface,
    textAlign: 'center',
  },
  emptyWelcomeSubtitle: {
    fontSize: sf(13),
    color: c.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  starterChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  starterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
    marginHorizontal: 4,
  },
  reactionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000000',
    margin: 0,
    padding: 0,
  },
  lightboxBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  lightboxImage: {
    width: '100%',
    height: '80%',
  },
  lightboxHeaderActions: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  profileSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
  reactionPopoverSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    borderTopWidth: 1,
    borderColor: c.surfaceVariant,
  },
});
