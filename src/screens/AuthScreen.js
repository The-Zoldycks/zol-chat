import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();

  const onSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      if (isSignUp) {
        await register({ email: email.trim().toLowerCase(), password });
      } else {
        await login({ email: email.trim().toLowerCase(), password });
      }
    } catch (e) {
      setError(e.message.replace('Firebase: ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.content}>
        <Text variant="displaySmall" style={styles.title}>zol chat</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Beautiful and private conversations.</Text>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
            <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
            <Button mode="contained" onPress={onSubmit} loading={submitting} disabled={submitting || !email || !password}>
              {isSignUp ? 'Create account' : 'Login'}
            </Button>
            <Button mode="text" onPress={() => setIsSignUp((prev) => !prev)} style={styles.switchButton}>
              {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign up'}
            </Button>
          </Card.Content>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    gap: 14,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    opacity: 0.8,
  },
  card: {
    borderRadius: 20,
  },
  input: {
    marginTop: 10,
    marginBottom: 8,
  },
  switchButton: {
    marginTop: 8,
  },
});
