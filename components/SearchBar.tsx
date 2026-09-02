import { View, TextInput, StyleSheet, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useThemeColors } from '../src/hooks/useTheme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search...', style }: SearchBarProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.inputBackground }, style]}>
      <MaterialIcons name="search" size={20} color={colors.textTertiary} />
      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCorrect={false}
      />
      {value.length > 0 && (
        <MaterialIcons
          name="close"
          size={18}
          color={colors.textTertiary}
          onPress={() => onChangeText('')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
});
