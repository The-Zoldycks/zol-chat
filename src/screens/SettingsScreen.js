import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Avatar, Button, Card, Text, TextInput } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { storage } from '../services/firebase';

export default function SettingsScreen() {
  const { profile, logout, updateUserProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to set profile image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    const blob = await (await fetch(imageUri)).blob();
    const fileRef = ref(storage, `avatars/${profile.uid}-${Date.now()}.jpg`);
    await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
    const url = await getDownloadURL(fileRef);
    setPhotoURL(url);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await updateUserProfile({ username: username.trim(), photoURL });
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
          {photoURL ? (
            <Avatar.Image source={{ uri: photoURL }} size={90} />
          ) : (
            <Avatar.Text label={(username || profile?.email || '?').slice(0, 2).toUpperCase()} size={90} />
          )}
          <Button mode="outlined" onPress={pickImage}>Choose profile image</Button>
          <TextInput label="Username" value={username} onChangeText={setUsername} />
          <TextInput label="Profile image URL" value={photoURL} onChangeText={setPhotoURL} autoCapitalize="none" />
          <Text variant="bodySmall">Email: {profile?.email}</Text>
          <Button mode="contained" onPress={onSave} loading={saving} disabled={saving}>Save profile</Button>
          <Button mode="text" onPress={logout}>Log out</Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 16,
  },
  content: {
    gap: 12,
  },
});
