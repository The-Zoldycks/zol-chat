# zol-chat

Beautiful Expo + Firebase chat app with account auth, direct messaging, chat list, and profile settings.

## Features
- Email/password signup + login (Firebase Auth)
- Start chat using someone else's email or username
- Home page with all chats and floating action button (FAB) to start new chat
- Chat room with real-time messages
- Settings page to set username and profile image (upload to Firebase Storage)
- Dark, classy UI powered by React Native Paper

## Quick start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Expo:
   ```bash
   npm run start
   ```

## Firebase collections used
- `users/{uid}`: profile data (email, username, photoURL)
- `chats/{chatId}`: participants + last message
- `chats/{chatId}/messages/{messageId}`: message stream

## Note
For production, add Firebase security rules and move Firebase keys to env vars.
