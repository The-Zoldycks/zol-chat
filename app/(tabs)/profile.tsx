import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useThemeColors } from '../../src/hooks/useTheme';
import { useThemeContext } from '../../src/contexts/ThemeContext';
import { Avatar } from '../../components/Avatar';
import { uploadToCloudinary } from '../../src/services/cloudinaryService';
import { clearAllMessageCaches } from '../../src/services/localMessageCache';

export default function ProfileScreen() {
  const { userProfile, updateProfile, signOut } = useAuth();
  const colors = useThemeColors();
  const { mode, setMode } = useThemeContext();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(userProfile?.username || '');
  const [uploading, setUploading] = useState(false);

  const handleSaveUsername = async () => {
    if (!username.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }
    try {
      await updateProfile({ username: username.trim() });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        await updateProfile({ photoURL: url });
      } catch (e: any) {
        Alert.alert('Upload Failed', e.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAllMessageCaches();
          await signOut();
        },
      },
    ]);
  };

  const themeOptions = [
    { key: 'system' as const, icon: 'phone-android', label: 'System' },
    { key: 'light' as const, icon: 'light-mode', label: 'Light' },
    { key: 'dark' as const, icon: 'dark-mode', label: 'Dark' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerSection}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
            <Avatar uri={userProfile?.photoURL} size={100} />
            <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
              {uploading ? (
                <MaterialIcons name="hourglass-empty" size={18} color="#FFF" />
              ) : (
                <MaterialIcons name="camera-alt" size={18} color="#FFF" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Username</Text>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { color: colors.text, borderColor: colors.primary }]}
                value={username}
                onChangeText={setUsername}
                autoFocus
                maxLength={30}
              />
              <TouchableOpacity onPress={handleSaveUsername} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="check" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditing(false); setUsername(userProfile?.username || ''); }}>
                <MaterialIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.editRow} onPress={() => setEditing(true)}>
              <Text style={[styles.cardValue, { color: colors.text }]}>{userProfile?.username}</Text>
              <MaterialIcons name="edit" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>{userProfile?.email}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Theme</Text>
          <View style={styles.themeBar}>
            {themeOptions.map((opt) => {
              const isActive = mode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: isActive ? colors.primary : colors.inputBackground,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setMode(opt.key)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={opt.icon as any}
                    size={20}
                    color={isActive ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeOptionLabel,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.danger }]}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={20} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  headerSection: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 17,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontSize: 17,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  themeOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  logoutText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
