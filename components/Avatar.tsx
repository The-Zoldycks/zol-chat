import { Image, View, StyleSheet, type ImageStyle, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
  isBot?: boolean;
}

export function Avatar({ uri, size = 44, style, isBot }: AvatarProps) {
  const borderRadius = size / 2;

  if (isBot) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
        <MaterialIcons name="smart-toy" size={size * 0.55} color="#3B82F6" />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
        <MaterialIcons name="person" size={size * 0.55} color="#94A3B8" />
      </View>
    );
  }

  const imageStyle: ImageStyle = { width: size, height: size, borderRadius };

  return (
    <Image
      source={{ uri }}
      style={imageStyle}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
