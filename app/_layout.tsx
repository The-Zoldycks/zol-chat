import '../global.css';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { ThemeProvider, useThemeContext } from '../src/contexts/ThemeContext';
import {
  getActiveChatId,
  registerForPushNotifications,
  scheduleLocalMessageNotification,
  setupNotificationListeners,
} from '../src/services/notificationService';
import { subscribeToChats } from '../src/services/chatService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.title = 'ZolChat';
}

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isDark } = useThemeContext();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const backgroundColor = isDark ? '#121212' : '#F8FAFC';
    document.documentElement.style.backgroundColor = backgroundColor;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.body.style.backgroundColor = backgroundColor;
    document.body.style.colorScheme = isDark ? 'dark' : 'light';
    const root = document.getElementById('root');
    if (root) root.style.backgroundColor = backgroundColor;
  }, [isDark]);

  useEffect(() => {
    if (!user) return;
    registerForPushNotifications(user.uid).catch(() => {});
    const cleanup = setupNotificationListeners(undefined, (data: any) => {
      if (data?.chatId) router.push(`/chat/${data.chatId}`);
    });
    return cleanup;
  }, [user, router]);

  // Foreground local notifications: when a new message lands in a chat the
  // user is NOT viewing, show a banner. Previously nothing scheduled local
  // notifications and nothing sent pushes, so messages arrived silently.
  const seenChatsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!user) return;
    seenChatsRef.current = {};
    let firstSnap = true;
    const toMs = (ts: any): number => {
      try {
        if (!ts) return 0;
        if (typeof ts.toDate === 'function') return ts.toDate().getTime() || 0;
        if (typeof ts.seconds === 'number') return ts.seconds * 1000;
        if (typeof ts === 'number') return ts;
        return 0;
      } catch {
        return 0;
      }
    };
    const unsub = subscribeToChats(user.uid, (chatList: any[]) => {
      if (firstSnap) {
        // Baseline without notifying for pre-existing messages.
        chatList.forEach((c: any) => {
          seenChatsRef.current[c.id] = `${toMs(c.updatedAt)}|${c.lastMessage || ''}|${c.lastMessageSenderId || ''}`;
        });
        firstSnap = false;
        return;
      }
      chatList.forEach((c: any) => {
        const key = `${toMs(c.updatedAt)}|${c.lastMessage || ''}|${c.lastMessageSenderId || ''}`;
        const prev = seenChatsRef.current[c.id];
        seenChatsRef.current[c.id] = key;
        if (!prev || prev === key) return;
        // Only notify for others' messages, app foregrounded, chat not open.
        if (!c.lastMessage || c.lastMessageSenderId === user.uid) return;
        if (c.id === getActiveChatId()) return;
        if (AppState.currentState !== 'active') return;
        const senderName =
          c.participantMeta?.[c.lastMessageSenderId]?.username ||
          (c.isGroup ? `${c.groupName || 'Group'} • someone` : 'Someone');
        const title = c.isGroup && c.groupName ? c.groupName : c.id?.startsWith('zolbot__') ? 'Zolbot' : senderName;
        const body =
          c.lastMessageSenderId && c.lastMessageSenderId !== user.uid && !c.isGroup && !c.id?.startsWith('zolbot__')
            ? `${senderName}: ${c.lastMessage}`
            : c.isGroup
              ? `${senderName}: ${c.lastMessage}`
              : c.lastMessage;
        scheduleLocalMessageNotification({ title, body, chatId: c.id }).catch(() => {});
      });
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat/[chatId]"
          options={{
            headerShown: false,
            presentation: 'card',
          }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
