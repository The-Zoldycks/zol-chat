import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(uid) {
  // Push tokens only exist on physical devices, never on simulators or web.
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // NOTE: this must be the EAS project ID (app.json -> extra.eas.projectId),
  // not the Firebase project ID.
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  // Store the token on the user doc so a sender backend can target this user.
  if (uid && token?.data) {
    await setDoc(doc(db, 'users', uid), { pushToken: token.data }, { merge: true }).catch(() => {});
  }

  return token?.data || null;
}

export function setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) onNotificationReceived(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (onNotificationTapped) onNotificationTapped(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
