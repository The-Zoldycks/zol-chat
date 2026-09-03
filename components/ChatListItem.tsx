import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Avatar } from './Avatar';
import { useThemeColors } from '../src/hooks/useTheme';

interface ChatListItemProps {
  name: string;
  lastMessage: string;
  timestamp?: string;
  unreadCount?: number;
  avatarUri?: string | null;
  isBot?: boolean;
  isGlobal?: boolean;
  isGroup?: boolean;
  isOnline?: boolean;
  onPress: () => void;
  onNamePress?: () => void;
  onAvatarPress?: () => void;
}

export function ChatListItem({
  name,
  lastMessage,
  timestamp,
  unreadCount = 0,
  avatarUri,
  isBot,
  isGlobal,
  isGroup,
  isOnline,
  onPress,
  onNamePress,
  onAvatarPress,
}: ChatListItemProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={styles.avatarWrapper}
        onPress={onAvatarPress || onPress}
        activeOpacity={0.7}
      >
        {isGlobal ? (
          <View style={[styles.globalAvatar, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="public" size={28} color={colors.primary} />
          </View>
        ) : isGroup ? (
          <View style={[styles.globalAvatar, { backgroundColor: colors.primary + '20' }]}>
            <MaterialIcons name="group" size={28} color={colors.primary} />
          </View>
        ) : (
          <Avatar uri={avatarUri} size={52} isBot={isBot} />
        )}
        {isOnline && (
          <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.topRow}>
          {onNamePress ? (
            <TouchableOpacity onPress={onNamePress} activeOpacity={0.6}>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={[styles.name, { color: colors.text }]}
              numberOfLines={1}
            >
              {name}
            </Text>
          )}
          {timestamp && (
            <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
              {timestamp}
            </Text>
          )}
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.lastMessage, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {lastMessage || 'No messages yet'}
          </Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.unread }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrapper: {
    position: 'relative',
  },
  globalAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  badge: {
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
