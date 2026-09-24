# Zolchat

A real-time chat app built with Expo (React Native). Global chat, 1:1 DMs, and group chats with image sharing, @mentions, typing indicators, online presence, and Zolbot — a built-in AI assistant.

## Features

### Chats for every occasion

- **Global chat** — a public room where everyone in the app can jump in and talk.
- **Direct messages** — private 1:1 conversations, started by searching anyone by email or username.
- **Group chats** — create groups with a name and photo, add members from recent contacts or search, leave anytime.

### Messaging that feels instant

- **Real-time delivery** messages appear as they're sent, with optimistic pending states so your own texts show immediately.
- **Image messages** — pick from your library, preview before sending, tap any image to view it fullscreen.
- **@mentions** — type `@` to get live suggestions (including Zolbot), with highlighted mentions in bubbles.
- **Typing indicators** — see when someone (or several people) is typing.


### Presence and unread tracking

- **Online/offline presence** — green dots and "Online / Offline" labels on avatars, headers, and profile sheets, refreshed with a heartbeat.
- **Unread badges** — per-chat counts on the chat list that clear when you open the conversation and mark it read.

### Zolbot, the built-in AI assistant

- Every user gets a personal **Zolbot** chat powered by Groq — ask it anything without leaving the app.
- Mention `@Zolbot` in any group or global chat to pull it into the conversation.

### Search

- **In-chat search** — filter the open conversation as you type.
- **User search** — find people by email or username to start a new chat or add group members.

### Profile and personalization

- Editable **username** and **profile photo** (uploads to Cloudinary), shown across chats, member lists, and messages.
- **System / light / dark themes**, switchable anytime from the profile screen.
- Tap any avatar or chat header for a profile sheet with details, online status, and a shortcut to message that person directly.


## Project structure

```text
app/                  # expo-router screens
  (auth)/             # login, register
  (tabs)/             # chats, search, profile
  chat/[chatId].tsx   # conversation screen
components/           # Avatar, MessageBubble, MessageInput, ChatListItem, ...
src/
  services/           # firebase, chatService, cloudinaryService, notificationService, caches
  contexts/           # AuthContext, ThemeContext
  hooks/ config/ utils/
assets/               # icons, splash
```