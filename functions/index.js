const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp();
const db = getFirestore(app);

exports.groqChat = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { chatId } = request.data;
  if (!chatId || !chatId.startsWith("zolbot__")) {
    throw new HttpsError("invalid-argument", "Invalid chat ID.");
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Groq API key not configured.");
  }

  const senderId = request.auth.uid;

  // Ensure chat room document exists
  const chatRef = db.collection("chats").doc(chatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    const userSnap = await db.collection("users").doc(senderId).get();
    const userData = userSnap.data() || {};
    await chatRef.set({
      id: chatId,
      participants: [senderId, "zolbot"],
      participantMeta: {
        [senderId]: {
          email: userData.email || request.auth.token.email || "",
          username: userData.username || "User",
          photoURL: userData.photoURL || "",
        },
        zolbot: {
          email: "zolbot@zoldyck.ai",
          username: "Zolbot",
          photoURL: "",
          isBot: true,
        },
      },
      lastMessage: "",
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  }

  // Fetch recent messages for context
  const messagesSnap = await chatRef
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(15)
    .get();

  const history = [];
  messagesSnap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data && data.text) {
      history.push(data);
    }
  });
  history.reverse();

  // Get username for system prompt
  const userSnap = await db.collection("users").doc(senderId).get();
  const userData = userSnap.data() || {};
  const username = userData.username || request.auth.token.email || "User";

  // Format messages for Groq API
  const groqMessages = [
    {
      role: "system",
      content: `You are Zolbot, a friendly and helpful AI chatbot integrated directly into the Zol Chat app.
You are chatting with ${username}.

Here is some basic information about Zol Chat to help you answer questions:
- What is Zol Chat: A real-time chat mobile application built using React Native, Expo, Firebase (Authentication, Firestore, Cloudinary), and React Native Paper for premium UI design.
- How to add chats: Tap the purple Floating Action Button (+) on the bottom right of the chats list, and search for other users by their email or username.
- How to customize profile: Navigate to the Settings tab (gear icon on bottom navigation) to update your username or set a profile photo.
- Theme: The app runs in a premium space-themed dark mode (featuring dark indigo backgrounds and purple/violet accents).

Keep your responses engaging, helpful, and concise (appropriate for a chat room bubble). If the user asks about the app's features or how to use it, refer to the guides above.`,
    },
    ...history.map((msg) => ({
      role: msg.senderId === "zolbot" ? "assistant" : "user",
      content: msg.text,
    })),
  ];

  // Call Groq API
  let botText;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    botText = data.choices?.[0]?.message?.content || "Sorry, I had trouble parsing the response.";
  } catch {
    botText = "Oops, I ran into an error trying to connect to my AI brain! Please check your network connection.";
  }

  // Save bot reply to Firestore
  await chatRef.collection("messages").add({
    text: botText,
    senderId: "zolbot",
    senderEmail: "zolbot@zoldyck.ai",
    senderUsername: "Zolbot",
    createdAt: new Date(),
  });

  await chatRef.update({
    lastMessage: botText,
    updatedAt: new Date(),
  });

  return { text: botText };
});
