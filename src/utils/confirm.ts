import { Alert, Platform } from 'react-native';

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmText?: string; destructive?: boolean }
): void {
  const confirmText = options?.confirmText || 'Confirm';

  if (Platform.OS === 'web') {
    try {
      const result = window.confirm(`${title}\n\n${message}`);
      if (result) {
        onConfirm();
      }
    } catch {
      // Fallback to Alert.alert on web if window.confirm fails
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: confirmText,
          style: options?.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ]);
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: confirmText,
      style: options?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
