import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
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
      setError(e.message.replace(/^Firebase:\s*/, ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/zol-logo.png')} style={styles.logo} />
          <Text variant="headlineLarge" style={styles.title}>zol chat</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Beautiful and private conversations.</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              mode="outlined"
              style={styles.input}
              outlineColor="#3C4770"
              activeOutlineColor="#9D7CFF"
              textColor="#ECF1FF"
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              mode="outlined"
              style={styles.input}
              outlineColor="#3C4770"
              activeOutlineColor="#9D7CFF"
              textColor="#ECF1FF"
            />
            {Boolean(error) && (
              <HelperText type="error" visible={Boolean(error)} style={styles.errorText}>
                {error}
              </HelperText>
            )}
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={submitting}
              disabled={submitting || !email || !password}
              style={styles.button}
              labelStyle={styles.buttonLabel}
            >
              {isSignUp ? 'Create account' : 'Login'}
            </Button>
            <Button
              mode="text"
              onPress={() => {
                setIsSignUp((prev) => !prev);
                setError('');
              }}
              style={styles.switchButton}
              textColor="#637099"
            >
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
    padding: 24,
    backgroundColor: '#090D1A',
  },
  content: {
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    fontWeight: '800',
    color: '#ECF1FF',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#637099',
    textAlign: 'center',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#12182C',
    borderWidth: 1,
    borderColor: '#1A2340',
  },
  cardContent: {
    paddingVertical: 12,
    gap: 4,
  },
  input: {
    backgroundColor: '#12182C',
    marginBottom: 8,
  },
  errorText: {
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 8,
    backgroundColor: '#9D7CFF',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 8,
  },
});
