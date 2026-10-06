import { Text, type TextProps } from 'react-native';
import { useThemeColors } from '../src/hooks/useTheme';

interface MentionTextProps extends Pick<TextProps, 'onPress' | 'onLongPress' | 'numberOfLines'> {
  text: string;
  style?: object;
  /** Highlight style override for @tags */
  mentionStyle?: object;
}

// Matches @tags: letters, numbers, _, ., - (covers @Zolbot, @john.doe, @user-1).
// Trailing punctuation (.,!?) is left outside the highlight.
const MENTION_REGEX = /(@[A-Za-z0-9_.-]+)/g;

export function MentionText({ text, style, mentionStyle, onPress, onLongPress, numberOfLines }: MentionTextProps) {
  const colors = useThemeColors();
  if (!text) return <Text style={style}>{text}</Text>;
  const parts = text.split(MENTION_REGEX);

  return (
    <Text style={style} onPress={onPress} onLongPress={onLongPress} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          const isZolbot = part.toLowerCase().startsWith('@zolbot');
          return (
            <Text
              key={i}
              style={[
                {
                  color: colors.primary,
                  fontWeight: '700',
                  backgroundColor: colors.primary + '22',
                  borderRadius: 4,
                } as any,
                isZolbot ? { fontWeight: '800' } : null,
                mentionStyle,
              ]}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
