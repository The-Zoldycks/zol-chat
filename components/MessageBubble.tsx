import { View, Text, Image, StyleSheet, TouchableOpacity, Platform } from 'react-native';
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
  reactions?: Record<string, string>;
  edited?: boolean;
  replyTo?: { id: string; text: string; senderName: string } | null;
  highlighted?: boolean;
  currentUid?: string;
  onReact?: (emoji: string) => void;
  onReplyPress?: (replyTo: { id: string; text: string; senderName: string }) => void;
  onImagePress?: (uri: string) => void;
  onAvatarPress?: () => void;
  onLongPress?: () => void;
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
  reactions,
  edited,
  replyTo,
  highlighted,
  currentUid,
  onReact,
  onReplyPress,
  onImagePress,
  onAvatarPress,
  onLongPress,
}: MessageBubbleProps) {
  const colors = useThemeColors();

  const reactionCounts: Record<string, { count: number; mine: boolean }> = {};
  if (reactions) {
    Object.entries(reactions).forEach(([uid, emoji]) => {
      if (!emoji) return;
      if (!reactionCounts[emoji]) reactionCounts[emoji] = { count: 0, mine: false };
      reactionCounts[emoji].count += 1;
      if (uid === currentUid) reactionCounts[emoji].mine = true;
    });
  }
  const reactionEntries = Object.entries(reactionCounts);

  // Desktop: right-click opens the message menu instead of the browser menu.
  const webContextMenuProps =
    Platform.OS === 'web' && onLongPress
      ? {
          onContextMenu: (e: any) => {
            e?.preventDefault?.();
            onLongPress();
          },
        }
      : {};

  return (
    <View style={[styles.container, { opacity: isPending ? 0.4 : 1 }, highlighted && { backgroundColor: colors.primary + '15' }]}>
      <TouchableOpacity style={styles.avatarCol} onPress={onAvatarPress} activeOpacity={0.7}>
        <Avatar uri={senderPhotoURL} size={32} isBot={isBot} />
      </TouchableOpacity>

      <View style={styles.contentCol}>
        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7}>
          <Text style={[styles.senderName, { color: isBot ? colors.primary : colors.primaryLight }]}>
            {senderName}
          </Text>
        </TouchableOpacity>

        {replyTo && (
          <TouchableOpacity
            onPress={() => onReplyPress?.(replyTo)}
            activeOpacity={0.7}
            style={[styles.quoteBox, { borderLeftColor: colors.primary, backgroundColor: colors.inputBackground }]}
          >
            <Text style={[styles.quoteName, { color: colors.primary }]} numberOfLines={1}>
              {replyTo.senderName}
            </Text>
            <Text style={[styles.quoteText, { color: colors.textSecondary }]} numberOfLines={2}>
              {replyTo.text || '📷 Photo'}
            </Text>
          </TouchableOpacity>
        )}

        {imageUrl && (
          <TouchableOpacity
            onPress={() => onImagePress?.(imageUrl)}
            onLongPress={onLongPress}
            activeOpacity={0.8}
            {...webContextMenuProps}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {text ? (
          <Text
            style={[styles.messageText, { color: colors.text }]}
            onLongPress={onLongPress}
            {...webContextMenuProps}
          >
            {text}
          </Text>
        ) : null}

        {reactionEntries.length > 0 && (
          <View style={styles.reactionRow}>
            {reactionEntries.map(([emoji, info]) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionChip,
                  info.mine && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
                ]}
                onPress={() => onReact?.(emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                  {info.count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {timestamp ? (
          <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
            {timestamp}{edited ? ' • edited' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Platform.OS === 'web' ? 28 : 16,
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
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  quoteBox: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  quoteName: {
    fontSize: 12,
    fontWeight: '700',
  },
  quoteText: {
    fontSize: 13,
  },
});
