import { Tabs } from 'expo-router';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { ResponsiveTabBar } from '../../components/ResponsiveTabBar';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: desktop ? styles.desktopScene : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chats',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  desktopScene: {
    marginLeft: 248,
  },
});
