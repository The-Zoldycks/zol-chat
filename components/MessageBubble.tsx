import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../src/hooks/useTheme';
import { Avatar } from './Avatar';

interface MessageBubbleProps {
  text: string;
  senderName: string;
  senderPhotoURL?: string;
  timestamp?: string;
  isOwn: boolean;
  isBot?: boolean;
  isPending?: boolean;
  isGroup?: boolean;
  imageUrl?: string;
  onImagePress?: (uri: string) => void;
  onAvatarPress?: () => void;
}

export function MessageBubble({
  text,
  senderName,
  senderPhotoURL,
  timestamp,
  isOwn,
  isBot,
  isPending,
  isGroup,
  imageUrl,
  onImagePress,
  onAvatarPress,
}: MessageBubbleProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { opacity: isPending ? 0.4 : 1 }]}>
      <TouchableOpacity style={styles.avatarCol} onPress={onAvatarPress} activeOpacity={0.7}>
        <Avatar uri={senderPhotoURL} size={32} isBot={isBot} />
      </TouchableOpacity>

      <View style={styles.contentCol}>
        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
          <Text style={[styles.senderName, { color: isBot ? colors.primary : colors.primaryLight }]}>
            {senderName}
          </Text>
        </TouchableOpacity>

        {imageUrl && (
          <TouchableOpacity onPress={() => onImagePress?.(imageUrl)} activeOpacity={0.8}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {text ? (
          <Text style={[styles.messageText, { color: colors.text }]}>{text}</Text>
        ) : null}

        {timestamp ? (
          <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
            {timestamp}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  avatarCol: {
    marginRight: 10,
    marginTop: 2,
  },
  contentCol: {
    flex: 1,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageImage: {
    width: 220,
    height: 160,
    borderRadius: 12,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 2,
  },
});
