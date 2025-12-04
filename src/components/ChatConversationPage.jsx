// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import MediaViewer from "./Chat/MediaViewer";
import TypingIndicator from "./Chat/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { profilePic, profileName } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [mediaViewerData, setMediaViewerData] = useState({ isOpen: false, items: [], startIndex: 0 });
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);

  // -------------------- Load chat & friend --------------------
  useEffect(() => {
    if (!chatId) return;
    setLoading(true);

    const chatRef = doc(db, "chats", chatId);
    const unsubChat = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(data.blocked || false);
      setTypingUsers(data.typing || {});

      // Load friend
      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      // Load pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      }

      setLoading(false);
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data(), status: "sent" }));
      setMessages(docs);
      scrollToBottom();
    });

    return () => unsub();
  }, [chatId]);

  // -------------------- Scroll --------------------
  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // -------------------- Group messages by date --------------------
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

  const groupedMessages = [];
  let lastDate = null;
  messages.forEach((msg) => {
    const dateStr = formatDateSeparator(msg.createdAt);
    if (dateStr !== lastDate) {
      groupedMessages.push({ type: "date-separator", date: dateStr });
      lastDate = dateStr;
    }
    groupedMessages.push({ type: "message", data: msg });
  });

  const scrollToMessage = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // -------------------- File Input --------------------
  const handleAddFiles = () => fileInputRef.current?.click();
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = null;
  };

  // -------------------- Media Viewer --------------------
  const handleOpenMediaViewer = (clickedMediaUrl) => {
    const mediaItems = messages
      .filter((m) => m.mediaUrl)
      .map((m) => ({ url: m.mediaUrl, type: m.mediaType || "image" }));
    const startIndex = mediaItems.findIndex((m) => m.url === clickedMediaUrl);
    setMediaViewerData({ isOpen: true, items: mediaItems, startIndex: startIndex >= 0 ? startIndex : 0 });
  };

  // -------------------- Chat actions --------------------
  const friendId = friendInfo?.id || null;

  const startVoiceCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/voicecall/${chatId}/${friendId}`);
  };
  const startVideoCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/videocall/${chatId}/${friendId}`);
  };
  const onSearch = () => toast.info("Search not implemented.");
  const onGoToPinned = (messageId) => {
    const id = messageId || pinnedMessage?.id;
    if (id) scrollToMessage(id);
    else toast.info("No pinned message available.");
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Loading chat...</p>
      </div>
    );
  }

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
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        multiple
        accept="image/*,video/*"
        onChange={handleFilesSelected}
      />

      <ChatHeader
        friendId={friendId}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onClearChat={async () => {
          if (!window.confirm("Clear this chat?")) return;
          messages.forEach(async (msg) => {
            const msgRef = doc(db, "chats", chatId, "messages", msg.id);
            await updateDoc(msgRef, { deleted: true });
          });
          toast.success("Chat cleared");
        }}
        onSearch={onSearch}
        onGoToPinned={onGoToPinned}
      />

      {/* Messages */}
      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
      >
        {groupedMessages.map((item, idx) =>
          item.type === "date-separator" ? (
            <div
              key={idx}
              style={{ textAlign: "center", margin: "10px 0", fontSize: 12, color: isDark ? "#aaa" : "#555" }}
            >
              {item.date}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={{ ...item.data, uploadProgress: uploadProgress[item.data.id] }}
              myUid={myUid}
              isDark={isDark}
              chatId={chatId}
              setReplyTo={setReplyTo}
              pinnedMessage={pinnedMessage}
              setPinnedMessage={setPinnedMessage}
              friendId={friendId}
              onReplyClick={scrollToMessage}
              onOpenMediaViewer={handleOpenMediaViewer}
              messages={messages}
              typingUsers={typingUsers}
            />
          )
        )}
        <TypingIndicator typingUsers={typingUsers} myUid={myUid} />
        <div ref={endRef} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={() => {} /* Implement sendMessage function */}
        sendMediaMessage={setSelectedFiles}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
      />

      {mediaViewerData.isOpen && (
        <MediaViewer
          items={mediaViewerData.items}
          startIndex={mediaViewerData.startIndex}
          onClose={() => setMediaViewerData({ ...mediaViewerData, isOpen: false })}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}