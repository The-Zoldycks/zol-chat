import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const darkColors = {
  primary: '#4A90E2',
  secondary: '#30D5C8',
  background: '#090D1A',
  surface: '#12182C',
  surfaceVariant: '#1A2340',
  onSurface: '#ECF1FF',
  outline: '#3C4770',
  muted: '#637099',
  danger: '#FF6B6B',
  white: '#FFFFFF',
  chatTheirs: '#161D30',
};

export const lightColors = {
  primary: '#3478F6',
  secondary: '#2AB5A8',
  background: '#F5F5FA',
  surface: '#FFFFFF',
  surfaceVariant: '#E8E8F0',
  onSurface: '#1A1A2E',
  outline: '#C0C0D0',
  muted: '#808099',
  danger: '#E04040',
  white: '#FFFFFF',
  chatTheirs: '#ECECF5',
};

export const colors = darkColors;

const systemFontConfig = {
  fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  fonts: {
    displaySmall: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    displayMedium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    displayLarge: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    headlineSmall: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    headlineMedium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    headlineLarge: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    titleSmall: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
    titleMedium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
    titleLarge: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
    bodySmall: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    bodyMedium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    bodyLarge: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '400' },
    labelSmall: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
    labelMedium: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
    labelLarge: { fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto', weight: '500' },
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  ...systemFontConfig,
  colors: {
    ...MD3DarkTheme.colors,
    primary: darkColors.primary,
    secondary: darkColors.secondary,
    background: darkColors.background,
    surface: darkColors.surface,
    surfaceVariant: darkColors.surfaceVariant,
    onSurface: darkColors.onSurface,
    outline: darkColors.outline,
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  ...systemFontConfig,
  colors: {
    ...MD3LightTheme.colors,
    primary: lightColors.primary,
    secondary: lightColors.secondary,
    background: lightColors.background,
    surface: lightColors.surface,
    surfaceVariant: lightColors.surfaceVariant,
    onSurface: lightColors.onSurface,
    outline: lightColors.outline,
  },
};

export const appTheme = darkTheme;
