// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import axios from "axios";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { profilePic, profileName } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // -------------------- Load chat & friend info --------------------
  useEffect(() => {
    if (!chatId) return;
    let unsubChat = null;
    let unsubUser = null;

    const loadMeta = async () => {
      try {
        const cRef = doc(db, "chats", chatId);
        unsubChat = onSnapshot(cRef, (s) => {
          if (s.exists()) {
            const data = s.data();
            setChatInfo({ id: s.id, ...data });

            const friendId = data.participants?.find((p) => p !== myUid);
            if (friendId) {
              const userRef = doc(db, "users", friendId);
              unsubUser = onSnapshot(userRef, (snap) => {
                if (snap.exists()) setFriendInfo({ id: snap.id, ...snap.data() });
              });
            }

            // Pinned message
            if (data.pinnedMessageId) {
              const pinnedMsgRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
              onSnapshot(pinnedMsgRef, (snap) => {
                if (snap.exists()) setPinnedMessage({ id: snap.id, ...snap.data() });
              });
            }
          }
        });
      } catch (e) {
        console.error("loadMeta error", e);
      }
    };

    loadMeta();
    return () => {
      if (unsubChat) unsubChat();
      if (unsubUser) unsubUser();
    };
  }, [chatId, myUid]);

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoadingMsgs(true);

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
      setLoadingMsgs(false);
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Date helpers --------------------
  const formatDateSeparator = (date) => {
    if (!date) return "";
    const msgDate = new Date(date.toDate?.() || date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (msgDate.toDateString() === now.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";

    const options = { month: "short", day: "numeric" };
    if (msgDate.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return msgDate.toLocaleDateString(undefined, options);
  };

  const groupMessagesByDay = (msgs) => {
    const grouped = [];
    let lastDate = null;

    msgs.forEach((msg) => {
      const timestamp = msg.createdAt || new Date();
      const dateStr = formatDateSeparator(timestamp);
      if (dateStr !== lastDate) {
        grouped.push({ type: "date-separator", date: dateStr });
        lastDate = dateStr;
      }
      grouped.push({ type: "message", data: msg });
    });

    return grouped;
  };

  const groupedMessages = groupMessagesByDay(messages);

  // -------------------- Send text message --------------------
  const sendTextMessage = async () => {
    if (!text.trim() && selectedFiles.length === 0) return;

    try {
      if (selectedFiles.length > 0) {
        setShowPreview(true);
        return;
      }

      const payload = {
        senderId: myUid,
        text: text.trim(),
        mediaUrl: "",
        mediaType: null,
        createdAt: serverTimestamp(),
        reactions: {},
        delivered: false,
        seen: false,
      };

      if (replyTo) {
        payload.replyTo = {
          id: replyTo.id,
          text: replyTo.text,
          senderId: replyTo.senderId,
        };
        setReplyTo(null);
      }

      await addDoc(collection(db, "chats", chatId, "messages"), payload);
      setText("");
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------- Send media messages (Cloudinary) --------------------
  const sendMediaMessage = async (files) => {
    if (!files || files.length === 0) return;

    setShowPreview(false);

    for (let f of files) {
      const type = f.type.startsWith("image/")
        ? "image"
        : f.type.startsWith("video/")
        ? "video"
        : f.type.startsWith("audio/")
        ? "audio"
        : "file";

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", f);
      formData.append("upload_preset", "YOUR_CLOUDINARY_PRESET"); // replace
      const res = await axios.post(
        "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/auto/upload",
        formData
      );
      const mediaUrl = res.data.secure_url;

      const payload = {
        senderId: myUid,
        text: f.name,
        mediaUrl,
        mediaType: type,
        createdAt: serverTimestamp(),
        reactions: {},
        delivered: false,
        seen: false,
      };

      if (replyTo) {
        payload.replyTo = {
          id: replyTo.id,
          text: replyTo.text,
          senderId: replyTo.senderId,
        };
        setReplyTo(null);
      }

      await addDoc(collection(db, "chats", chatId, "messages"), payload);
    }

    setSelectedFiles([]);
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <ChatHeader
        friendId={friendInfo?.id}
        chatId={chatId}
        onClearChat={() => {}}
        onSearch={() => {}}
      />

      {/* Pinned message */}
      {pinnedMessage && (
        <div
          style={{
            background: "#f39c12",
            color: "#fff",
            padding: 6,
            borderRadius: 8,
            margin: 8,
            fontSize: 14,
          }}
        >
          📌 {pinnedMessage.text || pinnedMessage.mediaType || "Media"}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {loadingMsgs && (
          <div style={{ textAlign: "center", marginTop: 12 }}>Loading...</div>
        )}

        {groupedMessages.map((item, idx) =>
          item.type === "date-separator" ? (
            <div
              key={idx}
              style={{
                textAlign: "center",
                margin: "10px 0",
                position: "relative",
                fontSize: 12,
                color: isDark ? "#aaa" : "#555",
              }}
            >
              <span
                style={{
                  background: isDark ? "#0b0b0b" : "#f5f5f5",
                  padding: "0 8px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {item.date}
              </span>
              <hr
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  width: "100%",
                  borderColor: isDark ? "#555" : "#ccc",
                  zIndex: 0,
                }}
              />
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              chatId={chatId}
              setReplyTo={setReplyTo}
              pinnedMessage={pinnedMessage}
              setPinnedMessage={setPinnedMessage}
            />
          )
        )}

        {typingUsers.length > 0 && (
          <div style={{ fontSize: 12, color: "#888", margin: 4 }}>
            {typingUsers.join(", ")} typing...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chat input */}
      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        sendMediaMessage={sendMediaMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        setShowPreview={setShowPreview}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />

      {/* Image / Video Preview */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={(i) =>
            setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
          }
          onSend={() => sendMediaMessage(selectedFiles)}
          onCancel={() => setShowPreview(false)}
          onAddFiles={() => document.getElementById("file-input")?.click()}
          isDark={isDark}
        />
      )}
    </div>
  );
}