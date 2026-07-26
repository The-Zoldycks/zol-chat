import { Component } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../theme/theme';

export default class ErrorBoundary extends Component {
  state = { hasError: false, isDark: true };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo?.componentStack);
  }

  async componentDidMount() {
    try {
      const val = await AsyncStorage.getItem('app_theme_mode');
      this.setState({ isDark: val !== 'light' });
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      const colors = this.state.isDark ? darkColors : lightColors;
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Something went wrong</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>The app encountered an unexpected error.</Text>
          <Button
            mode="contained"
            onPress={() => this.setState({ hasError: false })}
            style={[styles.button, { backgroundColor: colors.primary }]}
            labelStyle={styles.buttonLabel}
          >
            Try again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    borderRadius: 12,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
