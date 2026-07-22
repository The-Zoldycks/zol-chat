import { MD3DarkTheme } from 'react-native-paper';

export const colors = {
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

export const appTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    onSurface: colors.onSurface,
    outline: colors.outline,
  },
};
