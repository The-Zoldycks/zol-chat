import { useColorScheme, View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const defaultBackground = colorScheme === 'dark' ? '#151718' : '#fff';
  const backgroundColor = (colorScheme === 'dark' ? darkColor : lightColor) ?? defaultBackground;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
