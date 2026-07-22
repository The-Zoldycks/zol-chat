import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import AuthScreen from '../screens/AuthScreen';
import ChatsScreen from '../screens/ChatsScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: '#090D1A',
    card: '#12182C',
    text: '#ECF1FF',
    border: '#1A2340',
    primary: '#9D7CFF',
  },
};

function HomeTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          height: 60 + insets.bottom, 
          paddingBottom: Math.max(insets.bottom, 6), 
          paddingTop: 6, 
          backgroundColor: '#12182C', 
          borderTopWidth: 0 
        },
        tabBarActiveTintColor: '#9D7CFF',
        tabBarInactiveTintColor: '#637099',
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{ tabBarIcon: ({ color }) => <Icon source="chat" color={color} size={22} /> }}
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090D1A' }}>
        <ActivityIndicator color="#9D7CFF" />
      </View>
    );
  }

  return (
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
                headerStyle: { backgroundColor: '#12182C' },
                headerTintColor: '#ECF1FF',
                headerShadowVisible: false,
              }} 
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
