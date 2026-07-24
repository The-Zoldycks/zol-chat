import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const darkColors = {
  primary: '#9D7CFF',
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
  primary: '#7C5CD9',
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

export const darkTheme = {
  ...MD3DarkTheme,
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
