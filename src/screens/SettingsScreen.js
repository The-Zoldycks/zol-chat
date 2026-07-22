import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Card, IconButton, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../services/cloudinaryService';

export default function SettingsScreen() {
  const { user, profile, logout, updateUserProfile } = useAuth();
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
                  <ActivityIndicator size="small" color="#9D7CFF" />
                </View>
              )}
              <IconButton 
                icon="camera" 
                mode="contained" 
                size={20} 
                style={styles.cameraIcon} 
                containerColor="#9D7CFF" 
                iconColor="#090D1A" 
                onPress={pickImage} 
                disabled={saving}
              />
            </View>
            <Button mode="text" onPress={pickImage} textColor="#9D7CFF" style={styles.changePicBtn} disabled={saving}>
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
            outlineColor="#3C4770"
            activeOutlineColor="#9D7CFF"
            textColor="#ECF1FF"
            disabled={saving}
          />

          <TextInput 
            label="Profile Image URL (Optional)" 
            value={photoURL} 
            onChangeText={setPhotoURL} 
            mode="outlined"
            style={styles.input}
            outlineColor="#3C4770"
            activeOutlineColor="#9D7CFF"
            textColor="#ECF1FF"
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
            onPress={logout} 
            style={styles.logoutBtn} 
            textColor="#FF6B6B"
            outlineColor="#FF6B6B"
            disabled={saving}
          >
            Log Out
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#090D1A',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 24,
    backgroundColor: '#12182C',
    borderWidth: 1,
    borderColor: '#1A2340',
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
    backgroundColor: '#1A2340',
  },
  avatarLabel: {
    color: '#9D7CFF',
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
    backgroundColor: '#090D1A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1A2340',
  },
  emailLabel: {
    color: '#637099',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  emailValue: {
    color: '#ECF1FF',
    fontSize: 15,
    marginTop: 2,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#12182C',
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 4,
    marginTop: 8,
    backgroundColor: '#9D7CFF',
  },
  btnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    borderRadius: 12,
    paddingVertical: 4,
    borderColor: '#FF6B6B',
  },
});
