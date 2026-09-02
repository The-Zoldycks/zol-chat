import { Text } from 'react-native';
import { useThemeColors } from '../src/hooks/useTheme';

interface MentionTextProps {
  text: string;
  style?: object;
}

export function MentionText({ text, style }: MentionTextProps) {
  const colors = useThemeColors();
  const parts = text.split(/(@\w+)/g);

  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <Text key={i} style={{ color: colors.primary, fontWeight: '600' }}>
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
