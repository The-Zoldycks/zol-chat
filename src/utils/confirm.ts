import { Alert, Platform } from 'react-native';

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void | Promise<unknown>,
  options?: { confirmText?: string; destructive?: boolean }
): void {
  const confirmText = options?.confirmText || 'Confirm';
  // Async confirm handlers used to have rejections swallowed silently.
  const run = () => {
    try {
      const result = onConfirm();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch((e: any) => {
          Alert.alert('Error', e?.message || 'Something went wrong');
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Something went wrong');
    }
  };

  if (Platform.OS === 'web') {
    try {
      const result = window.confirm(`${title}\n\n${message}`);
      if (result) {
        run();
      }
    } catch {
      // Fallback to Alert.alert on web if window.confirm fails
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: confirmText,
          style: options?.destructive ? 'destructive' : 'default',
          onPress: run,
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
      onPress: run,
    },
  ]);
}
