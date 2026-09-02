import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const colors = useThemeColors();

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, username.trim());
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message || 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.logoContainer}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="person-add" size={40} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Join Zolchat today
          </Text>
        </View>

        <View style={styles.form}>
          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
            <MaterialIcons name="email" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
            <MaterialIcons name="person" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Username"
              placeholderTextColor={colors.textTertiary}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
            <MaterialIcons name="lock" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialIcons
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground }]}>
            <MaterialIcons name="lock-outline" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textTertiary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Login</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  form: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  button: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 15,
  },
});
