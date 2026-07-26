import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useUpdates } from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AppAlertProvider, showAlert } from './src/components/AppAlert';

function UpdateChecker() {
  const { isUpdateAvailable, downloadUpdate } = useUpdates();

  useEffect(() => {
    if (isUpdateAvailable) {
      showAlert(
        'Update Available',
        'A new version of the app is ready. Restart to apply the update.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart Now',
            style: 'primary',
            onPress: async () => {
              try {
                await downloadUpdate();
              } catch {}
            },
          },
        ]
      );
    }
  }, [isUpdateAvailable, downloadUpdate]);

  return null;
}

function ThemedApp() {
  const { paperTheme, isDark } = useTheme();
  return (
    <PaperProvider theme={paperTheme}>
      <AppAlertProvider />
      <UpdateChecker />
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </PaperProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <ThemedApp />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
