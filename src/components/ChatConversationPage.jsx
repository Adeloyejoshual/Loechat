// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams } from "react-router-dom";
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
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { FiChevronDown } from "react-icons/fi";

export default function ChatConversationPage() {
  const { chatId } = useParams();
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
  const [typing, setTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

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

      if (!isAtBottom) {
        const newUnread = docs.filter((m) => m.senderId !== myUid && !m.seenBy?.includes(myUid));
        setUnreadCount(newUnread.length);
        setShowScrollArrow(true);
      } else {
        scrollToBottom();
      }
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

      if (atBottom) {
        setUnreadCount(0);
        setShowScrollArrow(false);
      } else {
        if (unreadCount > 0) setShowScrollArrow(true);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [unreadCount]);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadCount(0);
    setShowScrollArrow(false);
  };

  // -------------------- Typing indicator --------------------
  useEffect(() => {
    if (!chatId || !friendInfo?.id) return;
    const typingRef = doc(db, "chats", chatId, "typingStatus", friendInfo.id);
    const unsubscribe = onSnapshot(typingRef, (snap) => {
      if (snap.exists()) {
        setTyping(snap.data()?.isTyping || false);
      } else {
        setTyping(false);
      }
    });
    return () => unsubscribe();
  }, [chatId, friendInfo?.id]);

  const handleTyping = async (value) => {
    setText(value);
    const typingRef = doc(db, "chats", chatId, "typingStatus", myUid);
    await updateDoc(typingRef, { isTyping: value.length > 0 });
  };

  const clearTyping = async () => {
    const typingRef = doc(db, "chats", chatId, "typingStatus", myUid);
    await updateDoc(typingRef, { isTyping: false });
  };

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

  const groupedMessages = messages.reduce((acc, msg) => {
    const dateStr = formatDateSeparator(msg.createdAt);
    const lastDate = acc.length ? acc[acc.length - 1].date : null;
    if (dateStr !== lastDate) acc.push({ type: "date-separator", date: dateStr });
    acc.push({ type: "message", data: msg });
    return acc;
  }, []);

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

  // -------------------- Send messages --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages to this user");
    if (!textMsg && files.length === 0) return;

    clearTyping();

    const messagesCol = collection(db, "chats", chatId, "messages");

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
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
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, status: "sent", createdAt: new Date() } : m
          )
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to send media");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      } finally {
        setUploadProgress((prev) => {
          const copy = { ...prev };
          delete copy[tempId];
          return copy;
        });
      }
    }

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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m
          )
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to send message");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
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

  // -------------------- Media Viewer --------------------
  const handleOpenMediaViewer = (clickedMediaUrl) => {
    const mediaItems = messages
      .filter((m) => m.mediaUrl)
      .map((m) => ({ url: m.mediaUrl, type: m.mediaType || "image" }));
    const startIndex = mediaItems.findIndex((m) => m.url === clickedMediaUrl);
    setMediaViewerData({ isOpen: true, items: mediaItems, startIndex: startIndex >= 0 ? startIndex : 0 });
  };

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
      />

      {/* Messages */}
      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", position: "relative" }}
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
              onReplyClick={(id) => scrollToMessage(id)}
              onOpenMediaViewer={(mediaUrl) => handleOpenMediaViewer(mediaUrl)}
            />
          )
        )}

        {/* Unread message badge with fade */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#34B7F1",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            cursor: "pointer",
            zIndex: 10,
            transition: "opacity 0.3s, transform 0.3s",
            opacity: unreadCount > 0 ? 1 : 0,
            pointerEvents: unreadCount > 0 ? "auto" : "none",
            transform: unreadCount > 0 ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-20px)",
          }}
          onClick={scrollToBottom}
        >
          {unreadCount} unread message{unreadCount > 1 ? "s" : ""}
        </div>

        {/* Scroll-to-bottom arrow */}
        {showScrollArrow && (
          <div
            onClick={scrollToBottom}
            style={{
              position: "fixed",
              bottom: 80,
              right: 20,
              backgroundColor: "#34B7F1",
              borderRadius: "50%",
              padding: 8,
              cursor: "pointer",
              zIndex: 10,
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              transition: "opacity 0.3s",
              opacity: showScrollArrow ? 1 : 0,
            }}
          >
            <FiChevronDown color="#fff" size={20} />
          </div>
        )}

        {/* Typing indicator */}
        {typing && (
          <div style={{ fontSize: 12, opacity: 0.7, margin: "4px 0", textAlign: "left" }}>
            {friendInfo?.displayName || "Friend"} is typing...
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Chat Input */}
      <ChatInput
        text={text}
        setText={handleTyping}
        sendTextMessage={() => sendMessage(text, selectedFiles)}
        sendMediaMessage={(files) => setSelectedFiles(files)}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        disabled={isBlocked}
      />

      {/* Media Viewer */}
      {mediaViewerData.isOpen && (
        <MediaViewer
          items={mediaViewerData.items}
          startIndex={mediaViewerData.startIndex}
          onClose={() => setMediaViewerData({ ...mediaViewerData, isOpen: false })}
        />
      )}

      {/* Toast */}
      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}