import { useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface AvatarProps {
  uri?: string | null;
  size?: number;
  style?: ViewStyle;
  isBot?: boolean;
}

export function Avatar({ uri, size = 44, style, isBot }: AvatarProps) {
  const borderRadius = size / 2;
  const [failed, setFailed] = useState(false);

  if (isBot) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
        <MaterialIcons name="smart-toy" size={size * 0.55} color="#3B82F6" />
      </View>
    );
  }

  if (!uri || failed) {
    return (
      <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
        <MaterialIcons name="person" size={size * 0.55} color="#94A3B8" />
      </View>
    );
  }

  return (
    <Image
      key={uri}
      source={{ uri }}
      style={{ width: size, height: size, borderRadius }}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
      onError={() => {
        console.warn('[Avatar] image failed to load:', uri);
        setFailed(true);
      }}
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