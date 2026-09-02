import { useColorScheme } from 'react-native';

const lightColors = {
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  primaryDark: '#1D4ED8',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  inputBackground: '#F1F5F9',
  error: '#EF4444',
  success: '#22C55E',
  online: '#22C55E',
  unread: '#2563EB',
  mention: '#DBEAFE',
  mentionText: '#1D4ED8',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  headerBackground: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.5)',
  fab: '#2563EB',
  fabText: '#FFFFFF',
  danger: '#EF4444',
  pending: 'rgba(0,0,0,0.3)',
};

const darkColors = {
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#2563EB',
  background: '#0F172A',
  surface: '#1E293B',
  surfaceVariant: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  border: '#334155',
  borderLight: '#1E293B',
  inputBackground: '#1E293B',
  error: '#F87171',
  success: '#4ADE80',
  online: '#4ADE80',
  unread: '#3B82F6',
  mention: '#1E3A5F',
  mentionText: '#60A5FA',
  tabBar: '#1E293B',
  tabBarBorder: '#334155',
  headerBackground: '#1E293B',
  overlay: 'rgba(0,0,0,0.7)',
  fab: '#3B82F6',
  fabText: '#FFFFFF',
  danger: '#F87171',
  pending: 'rgba(255,255,255,0.3)',
};

export type ThemeColors = typeof lightColors;

export function getColors(isDark: boolean): ThemeColors {
  return isDark ? darkColors : lightColors;
}

export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return getColors(scheme === 'dark');
}
