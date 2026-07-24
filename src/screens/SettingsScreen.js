import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Card, IconButton, Switch, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { uploadToCloudinary } from '../services/cloudinaryService';

export default function SettingsScreen() {
  const { user, profile, logout, updateUserProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [username, setUsername] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Synchronize state when the profile loads or updates
  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to set profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled) return;

    setUploading(true);
    setSaving(true);
    try {
      const imageUri = result.assets[0].uri;
      const url = await uploadToCloudinary(imageUri);
      setPhotoURL(url);
      await updateUserProfile({ username: username.trim() || profile?.username, photoURL: url });
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (e) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ username: username.trim(), photoURL });
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (e) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {photoURL ? (
                <Avatar.Image source={{ uri: photoURL }} size={100} style={styles.avatarShadow} />
              ) : (
                <Avatar.Text 
                  label={(username || profile?.email || user?.email || '?').slice(0, 2).toUpperCase()} 
                  size={100} 
                  style={styles.avatarBg}
                  labelStyle={styles.avatarLabel}
                />
              )}
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              <IconButton 
                icon="camera" 
                mode="contained" 
                size={20} 
                style={styles.cameraIcon} 
                containerColor={colors.primary} 
                iconColor={colors.background} 
                onPress={pickImage} 
                disabled={saving}
              />
            </View>
            <Button mode="text" onPress={pickImage} textColor={colors.primary} style={styles.changePicBtn} disabled={saving}>
              {uploading ? 'Uploading...' : 'Change Photo'}
            </Button>
          </View>

          <View style={styles.emailContainer}>
            <Text style={styles.emailLabel}>Registered Email</Text>
            <Text style={styles.emailValue}>{profile?.email || user?.email || 'N/A'}</Text>
          </View>

          <TextInput 
            label="Username" 
            value={username} 
            onChangeText={setUsername} 
            mode="outlined"
            style={styles.input}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
            textColor={colors.onSurface}
            disabled={saving}
          />

          <TextInput 
            label="Profile Image URL (Optional)" 
            value={photoURL} 
            onChangeText={setPhotoURL} 
            mode="outlined"
            style={styles.input}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
            textColor={colors.onSurface}
            autoCapitalize="none"
            disabled={saving}
          />

          <Button 
            mode="contained" 
            onPress={onSave} 
            loading={saving} 
            disabled={saving} 
            style={styles.saveBtn}
            labelStyle={styles.btnLabel}
          >
            Save Profile
          </Button>

          <Button 
            mode="outlined" 
            onPress={onLogout} 
            style={[styles.logoutBtn, { borderColor: colors.danger }]} 
            textColor={colors.danger}
            disabled={saving}
          >
            Log Out
          </Button>

          <View style={[styles.themeRow, { borderTopColor: colors.surfaceVariant }]}>
            <Text style={[styles.themeLabel, { color: colors.onSurface }]}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              color={colors.primary}
            />
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const createStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: c.background,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  content: {
    gap: 16,
    paddingVertical: 8,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrapper: {
    position: 'relative',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 26, 0.7)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  avatarShadow: {
    elevation: 4,
  },
  avatarBg: {
    backgroundColor: c.surfaceVariant,
  },
  avatarLabel: {
    color: c.primary,
    fontWeight: 'bold',
    fontSize: 36,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    margin: 0,
  },
  changePicBtn: {
    marginTop: 4,
  },
  emailContainer: {
    backgroundColor: c.background,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: c.surfaceVariant,
  },
  emailLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emailValue: {
    color: c.onSurface,
    fontSize: 15,
    marginTop: 2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: c.surface,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 8,
    backgroundColor: c.primary,
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
