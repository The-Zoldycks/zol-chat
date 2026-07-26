import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { OnlineProvider } from '../context/OnlineContext';
import { UnreadProvider, useUnread } from '../context/UnreadContext';
import { registerForPushNotifications } from '../services/notificationService';
import { colors as defaultColors } from '../theme/theme';
import AuthScreen from '../screens/AuthScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeTabs() {
  const insets = useSafeAreaInsets();
  const { totalUnread } = useUnread();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          height: 60 + insets.bottom, 
          paddingBottom: Math.max(insets.bottom, 6), 
          paddingTop: 6, 
          backgroundColor: colors.surface, 
          borderTopWidth: 0 
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          tabBarIcon: ({ color }) => <Icon source="chat" color={color} size={22} />,
          tabBarBadge: totalUnread > 0 ? totalUnread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            color: colors.white,
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: ({ color }) => <Icon source="cog" color={color} size={22} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (user) registerForPushNotifications().catch(() => {});
  }, [user]);

  const navTheme = {
    ...(isDark ? require('@react-navigation/native').DarkTheme : require('@react-navigation/native').DefaultTheme),
    colors: {
      ...(isDark ? require('@react-navigation/native').DarkTheme : require('@react-navigation/native')).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.onSurface,
      border: colors.surfaceVariant,
      primary: colors.primary,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <OnlineProvider>
      <UnreadProvider>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator>
            {user ? (
              <>
                <Stack.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
                <Stack.Screen 
                  name="ChatRoom" 
                  component={ChatRoomScreen} 
                  options={{ 
                    title: 'Chat',
                    headerStyle: { backgroundColor: colors.surface },
                    headerTintColor: colors.onSurface,
                    headerShadowVisible: false,
                  }} 
                />
              </>
            ) : (
              <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </UnreadProvider>
    </OnlineProvider>
  );
}
