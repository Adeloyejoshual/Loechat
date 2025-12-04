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
import axios from "axios";

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
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [mediaViewerData, setMediaViewerData] = useState({ isOpen: false, items: [], startIndex: 0 });
  const [typingUsers, setTypingUsers] = useState({});

  // -------------------- Load chat & friend info --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(data.blocked || false);

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      }

      setTypingUsers(data.typing || {});
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
      if (isAtBottom) scrollToBottom();
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
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

  // -------------------- Group messages by date --------------------
  const groupedMessages = [];
  let lastDateStr = null;
  messages.forEach((msg) => {
    const dateStr = formatDateSeparator(msg.createdAt);
    if (dateStr !== lastDateStr) {
      groupedMessages.push({ type: "date-separator", date: dateStr });
      lastDateStr = dateStr;
    }
    groupedMessages.push({ type: "message", data: msg });
  });

  const scrollToMessage = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // -------------------- File Input Handlers --------------------
  const handleAddFiles = () => fileInputRef.current?.click();
  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = null;
  };

  // -------------------- Send messages --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages to this user");
    if (!textMsg && files.length === 0) return;

    const messagesCol = collection(db, "chats", chatId, "messages");

    // --- Media messages ---
    for (const f of files) {
      const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file";
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg || "",
        mediaUrl: URL.createObjectURL(f),
        mediaType: type,
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        status: "sending",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      };
      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      try {
        let mediaUrl = "";
        if (type !== "file") {
          const formData = new FormData();
          formData.append("file", f);
          formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            formData,
            {
              onUploadProgress: (e) => {
                const percent = Math.round((e.loaded * 100) / e.total);
                setUploadProgress((prev) => ({ ...prev, [tempId]: percent }));
              },
            }
          );
          mediaUrl = res.data.secure_url;
        }

        const payload = {
          senderId: myUid,
          text: textMsg || "",
          mediaUrl,
          mediaType: type,
          createdAt: serverTimestamp(),
          reactions: {},
          seenBy: [],
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        };

        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, status: "sent", createdAt: new Date() } : m))
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to send media");
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      } finally {
        setUploadProgress((prev) => {
          const copy = { ...prev };
          delete copy[tempId];
          return copy;
        });
      }
    }

    // --- Text-only message ---
    if (textMsg.trim() && files.length === 0) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg.trim(),
        mediaUrl: "",
        mediaType: null,
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        status: "sending",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      };
      setMessages((prev) => [...prev, tempMessage]);
      scrollToBottom();

      try {
        const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m)));
      } catch (err) {
        console.error(err);
        toast.error("Failed to send message");
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
      }
    }

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      lastMessage: textMsg || "",
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
      lastMessageStatus: "delivered",
    });

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
  };

  const handleOpenMediaViewer = (clickedMediaUrl) => {
    const mediaItems = messages
      .filter((m) => m.mediaUrl)
      .map((m) => ({ url: m.mediaUrl, type: m.mediaType || "image" }));
    const startIndex = mediaItems.findIndex((m) => m.url === clickedMediaUrl);
    setMediaViewerData({ isOpen: true, items: mediaItems, startIndex: startIndex >= 0 ? startIndex : 0 });
  };

  // -------------------- Call Navigation --------------------
  const friendId = friendInfo?.id || null;

  const startVoiceCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/voicecall/${chatId}/${friendId}`);
  };

  const startVideoCall = () => {
    if (!friendId) return toast.error("Cannot start call — user not loaded yet.");
    navigate(`/videocall/${chatId}/${friendId}`);
  };

  const onSearch = () => toast.info("Search is not implemented in this view yet.");
  const onGoToPinned = (messageId) => {
    const id = messageId || pinnedMessage?.id;
    if (id) scrollToMessage(id);
    else toast.info("No pinned message available.");
  };

  const pinned = pinnedMessage || chatInfo?.pinnedMessage || null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
        position: "relative",
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
        friendId={friendInfo?.id}
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
        extraActions={
          <>
            <button onClick={startVoiceCall} style={{ marginRight: 8 }}>
              🎤 Voice Call
            </button>
            <button onClick={startVideoCall}>📹 Video Call</button>
          </>
        }
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
              friendId={friendInfo?.id}
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
        sendTextMessage={() => sendMessage(text, selectedFiles)}
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