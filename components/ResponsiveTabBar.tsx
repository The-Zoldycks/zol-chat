import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../src/hooks/useTheme';

const TAB_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: 'chat-bubble-outline',
  search: 'search',
  profile: 'person-outline',
};

export function ResponsiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;

  const items = state.routes.map((route, index) => {
    const focused = state.index === index;
    const options = descriptors[route.key].options;
    const label = typeof options.title === 'string' ? options.title : route.name;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.tabBarAccessibilityLabel || label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }}
        style={({ pressed }) => [
          desktop ? styles.desktopItem : styles.mobileItem,
          focused && { backgroundColor: colors.primary + '18' },
          pressed && { opacity: 0.72 },
        ]}
      >
        <MaterialIcons
          name={TAB_ICONS[route.name] || 'circle'}
          size={desktop ? 21 : 23}
          color={focused ? colors.primary : colors.textTertiary}
        />
        <Text
          style={[
            desktop ? styles.desktopLabel : styles.mobileLabel,
            { color: focused ? colors.primary : colors.textSecondary },
            focused && styles.activeLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  });

  if (desktop) {
    return (
      <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="forum" size={20} color="#FFFFFF" />
          </View>
          <Text style={[styles.brandName, { color: colors.text }]}>ZolChat</Text>
        </View>
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>WORKSPACE</Text>
        <View style={styles.desktopItems}>{items}</View>
      </View>
    );
  }

  return (
    <View style={[styles.mobileBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    zIndex: 20,
    left: 0,
    top: 0,
    bottom: 0,
    width: 248,
    paddingHorizontal: 18,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 42,
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  desktopItems: {
    gap: 6,
  },
  desktopItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 13,
    gap: 13,
  },
  desktopLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeLabel: {
    fontWeight: '700',
  },
  mobileBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  mobileItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  mobileLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});