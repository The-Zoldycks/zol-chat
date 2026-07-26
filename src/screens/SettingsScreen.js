import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Card, IconButton, Switch, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useTheme, FONT_SCALES } from '../context/ThemeContext';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { showAlert } from '../components/AppAlert';

export default function SettingsScreen() {
  const { user, profile, logout, updateUserProfile } = useAuth();
  const { colors, isDark, toggleTheme, fontScale, updateFontScale, scaleFont } = useTheme();
  const styles = useMemo(() => createStyles(colors, scaleFont), [colors, scaleFont]);
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
      showAlert('Permission needed', 'Please allow photo access to set profile image.', [{ text: 'OK' }]);
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
      showAlert('Success', 'Profile photo updated successfully!', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Upload failed', e?.message || String(e), [{ text: 'OK' }]);
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!username.trim()) {
      showAlert('Validation Error', 'Username cannot be empty.', [{ text: 'OK' }]);
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ username: username.trim(), photoURL });
      showAlert('Success', 'Profile updated successfully.', [{ text: 'OK' }]);
    } catch (e) {
      showAlert('Save failed', e?.message || String(e), [{ text: 'OK' }]);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = () => {
    showAlert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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

          <View style={[styles.fontSizeRow, { borderTopColor: colors.surfaceVariant }]}>
            <Text style={[styles.themeLabel, { color: colors.onSurface }]}>Font Size</Text>
            <View style={styles.fontSizeOptions}>
              {FONT_SCALES.map((opt) => (
                <Pressable
                  key={opt.label}
                  onPress={() => updateFontScale(opt.value)}
                  style={[
                    styles.fontSizeBtn,
                    {
                      backgroundColor: fontScale === opt.value ? colors.primary : colors.background,
                      borderColor: fontScale === opt.value ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.fontSizeBtnText,
                      {
                        color: fontScale === opt.value ? colors.background : colors.onSurface,
                        fontSize: Math.round(13 * opt.value),
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const createStyles = (c, sf) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  scrollContent: {
    padding: 20,
    paddingVertical: 28,
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
    fontSize: sf(11),
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emailValue: {
    color: c.onSurface,
    fontSize: sf(15),
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
    fontSize: sf(15),
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
    fontSize: sf(16),
    fontWeight: '500',
  },
  fontSizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  fontSizeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  fontSizeBtn: {
    borderWidth: 1,
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontSizeBtnText: {
    fontWeight: '600',
  },
});
