// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [stickyDate, setStickyDate] = useState("");

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

        // Typing indicator
        setFriendTyping(Boolean(data.typing?.[friendId]));
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      }
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages + seen/delivered --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Mark delivered & seen
      docs.forEach(async (m) => {
        if (m.senderId !== myUid) {
          if (!m.deliveredTo?.includes(myUid))
            await updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) });
          if (!m.seenBy?.includes(myUid))
            await updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) });
        }
      });

      setMessages(docs);

      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId, isAtBottom, myUid]);

  // -------------------- Scroll detection & sticky date --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);

      // Sticky date
      const children = Array.from(el.children).filter((c) => c.dataset?.type === "message");
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();
        if (rect.top - parentRect.top >= 0) {
          const msgDate = child.dataset.date;
          if (msgDate !== stickyDate) setStickyDate(msgDate);
          break;
        }
      }
    };

    el.addEventListener("scroll", onScroll);
    onScroll(); // initial check
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages, stickyDate]);

  // -------------------- Typing indicator --------------------
  const handleUserTyping = useCallback(
    (typing) => {
      if (!chatId) return;
      const chatRef = doc(db, "chats", chatId);
      updateDoc(chatRef, { [`typing.${myUid}`]: typing ? serverTimestamp() : null }).catch(() => {});
    },
    [chatId, myUid]
  );

  // -------------------- Send message --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages to this user");
    if (!textMsg && files.length === 0) return;

    const messagesCol = collection(db, "chats", chatId, "messages");

    for (let f of files) {
      const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file";
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: f.name,
        mediaUrl: URL.createObjectURL(f),
        mediaType: type,
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        deliveredTo: [],
        status: "sending",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      };

      setMessages((prev) => [...prev, tempMessage]);
      endRef.current?.scrollIntoView({ behavior: "smooth" });

      try {
        const formData = new FormData();
        formData.append("file", f);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData
        );

        const payload = {
          senderId: myUid,
          text: f.name,
          mediaUrl: res.data.secure_url,
          mediaType: type,
          createdAt: serverTimestamp(),
          reactions: {},
          seenBy: [],
          deliveredTo: [],
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        };

        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, status: "sent", createdAt: new Date() } : m
          )
        );
      } catch {
        toast.error(`Failed to send ${f.name}`);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    }

    if (textMsg.trim()) {
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
        deliveredTo: [],
        status: "sending",
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
      };

      setMessages((prev) => [...prev, tempMessage]);
      endRef.current?.scrollIntoView({ behavior: "smooth" });

      try {
        const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m
          )
        );
      } catch {
        toast.error("Failed to send message");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    }

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: textMsg || files[0]?.name,
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
      lastMessageStatus: "delivered",
    });

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
    setShowPreview(false);
  };

  // -------------------- Add reaction --------------------
  const handleReaction = async (messageId, emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", messageId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const hasReacted = msg.reactions?.[emoji]?.includes(myUid);
    const update = hasReacted
      ? { [`reactions.${emoji}`]: arrayRemove(myUid) }
      : { [`reactions.${emoji}`]: arrayUnion(myUid) };

    try {
      await updateDoc(msgRef, update);
    } catch {
      toast.error("Failed to react");
    }
  };

  // -------------------- Date formatting --------------------
  const formatDateLabel = (date) => {
    const d = new Date(date.toDate?.() || date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString();
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
      <ChatHeader
        friendId={friendInfo?.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
      />

      {stickyDate && (
        <div
          style={{
            position: "sticky",
            top: 0,
            backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
            color: isDark ? "#888" : "#555",
            fontSize: 12,
            padding: "4px 0",
            textAlign: "center",
            zIndex: 5,
          }}
        >
          {stickyDate}
        </div>
      )}

      <div
        ref={messagesRefEl}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            chatId={chatId}
            setReplyTo={setReplyTo}
            pinnedMessage={pinnedMessage}
            setPinnedMessage={setPinnedMessage}
            friendId={friendInfo?.id}
            onReaction={handleReaction}
            data-date={formatDateLabel(msg.createdAt)}
          />
        ))}
        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div style={{ padding: 4, color: isDark ? "#aaa" : "#555", fontSize: 12 }}>
          {friendInfo?.displayName || "Friend"} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={() => sendMessage(text, selectedFiles)}
        sendMediaMessage={(files) => sendMessage("", files)}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        setShowPreview={setShowPreview}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        disabled={isBlocked}
        onTyping={handleUserTyping}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onSend={() => sendMessage("", selectedFiles)}
          onCancel={() => setShowPreview(false)}
          onAddFiles={() => document.getElementById("file-input")?.click()}
          isDark={isDark}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}