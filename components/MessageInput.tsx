import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors } from '../src/hooks/useTheme';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onImagePick: () => void;
  sending?: boolean;
  placeholder?: string;
}

export function MessageInput({
  value,
  onChangeText,
  onSend,
  onImagePick,
  sending,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const colors = useThemeColors();
  const hasText = value.trim().length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <TouchableOpacity onPress={onImagePick} style={styles.imageBtn} activeOpacity={0.7}>
        <MaterialIcons name="image" size={24} color={colors.primary} />
      </TouchableOpacity>

      <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={2000}
        />
      </View>

      {sending ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.sendBtn} />
      ) : (
        <TouchableOpacity
          onPress={onSend}
          style={[styles.sendBtn, hasText && { backgroundColor: colors.primary }]}
          activeOpacity={0.7}
          disabled={!hasText}
        >
          <MaterialIcons
            name="send"
            size={20}
            color={hasText ? '#FFFFFF' : colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  imageBtn: {
    padding: 8,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  input: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
