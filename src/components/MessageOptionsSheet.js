import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Divider, Modal, Portal, Text } from 'react-native-paper';
import { useTheme } from '../context/ThemeContext';

export default function MessageOptionsSheet({ visible, onDismiss, options }) {
  const { colors } = useTheme();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {}, 100);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onDismiss} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopColor: colors.surfaceVariant }]}>
          {options.map((opt, i) => {
            if (opt.divider) {
              return <Divider key={`d${i}`} style={[styles.divider, { backgroundColor: colors.surfaceVariant }]} />;
            }
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.row,
                  { opacity: pressed ? 0.6 : 1 },
                  opt.destructive && { backgroundColor: colors.danger + '12' },
                ]}
                onPress={() => {
                  onDismiss();
                  opt.onPress?.();
                }}
              >
                {opt.icon && <Text style={[styles.icon, { color: opt.destructive ? colors.danger : colors.onSurface }]}>{opt.icon}</Text>}
                <Text
                  style={[
                    styles.label,
                    { color: opt.destructive ? colors.danger : colors.onSurface },
                  ]}
                >
                  {opt.text}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            style={({ pressed }) => [styles.row, styles.cancelRow, { borderTopColor: colors.surfaceVariant, opacity: pressed ? 0.6 : 1 }]}
            onPress={onDismiss}
          >
            <Text style={[styles.label, styles.cancelLabel, { color: colors.muted }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    justifyContent: 'flex-end',
    margin: 0,
    backgroundColor: 'transparent',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  icon: {
    fontSize: 20,
    marginRight: 14,
    width: 28,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  cancelRow: {
    borderTopWidth: 1,
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelLabel: {
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
});
