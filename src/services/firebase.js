import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAznztJ6uuyoi4DN5QnMJIbdoTFsNPYQDM',
  authDomain: 'zol-chat.firebaseapp.com',
  projectId: 'zol-chat',
  storageBucket: 'zol-chat.firebasestorage.app',
  messagingSenderId: '912377572954',
  appId: '1:912377572954:android:43e202bd424154b7613263',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
