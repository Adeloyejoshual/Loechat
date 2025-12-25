// src/components/Chat/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import MediaViewer from "./Chat/MediaViewer";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import TypingIndicator from "./Chat/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [friendTyping, setFriendTyping] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // ------------------ Load chat & friend info ------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(data.blocked || false);

      const friendId = data.participants?.find(p => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, s => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      // Load pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, s => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else setPinnedMessage(null);
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // ------------------ Load messages ascending ------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);

      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => unsub();
  }, [chatId, isAtBottom]);

  // ------------------ Scroll detection ------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ------------------ Scroll to message ------------------
  const scrollToMessage = id => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ------------------ Group messages by day ------------------
  const formatDate = date => {
    if (!date) return "";
    const d = new Date(date.toDate?.() || date);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const dateStr = formatDate(msg.createdAt);
    const lastDate = acc.length ? acc[acc.length - 1].date : null;
    if (dateStr !== lastDate) acc.push({ type: "date-separator", date: dateStr });
    acc.push({ type: "message", data: msg });
    return acc;
  }, []);

  // ------------------ Send text ------------------
  const sendTextMessage = async (txt, reply = null) => {
    if (isBlocked) return toast.error("You cannot send messages");
    if (!txt) return;
    const messagesCol = collection(db, "chats", chatId, "messages");
    const payload = {
      senderId: myUid,
      text: txt,
      createdAt: serverTimestamp(),
      reactions: {},
      seenBy: [],
      replyTo: reply ? { id: reply.id, text: reply.text } : null,
    };
    const docRef = await addDoc(messagesCol, payload);
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: txt,
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
    });
  };

  // ------------------ Send media ------------------
  const sendMediaMessage = async (files, reply = null) => {
    if (!files.length) return;
    const messagesCol = collection(db, "chats", chatId, "messages");
    for (let f of files) {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`, { method: "POST", body: formData });
      const url = (await res.json()).secure_url;
      const payload = {
        senderId: myUid,
        text: "",
        mediaUrl: url,
        mediaType: f.type.startsWith("video/") ? "video" : "image",
        createdAt: serverTimestamp(),
        reactions: {},
        seenBy: [],
        replyTo: reply ? { id: reply.id, text: reply.text } : null,
      };
      await addDoc(messagesCol, payload);
    }
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: "Media",
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
    });
  };

  // ------------------ Delete message ------------------
  const deleteMessage = async (msgId, type = "me") => {
    try {
      const msgRef = doc(db, "chats", chatId, "messages", msgId);
      if (type === "everyone") await deleteDoc(msgRef);
      else await updateDoc(msgRef, { text: "This message was deleted", mediaUrl: "", deleted: true });
    } catch (err) { console.error(err); }
  };

  // ------------------ Pin message ------------------
  const pinMessage = async (msg) => {
    if (!msg) return setPinnedMessage(null);
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { pinnedMessageId: msg.id });
    setPinnedMessage(msg);
  };

  // ------------------ Media viewer ------------------
  const openMediaViewer = (startIndex) => { setMediaIndex(startIndex); setShowMediaViewer(true); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5") }}>
      <ChatHeader
        friendId={friendInfo?.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={scrollToMessage}
      />

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}>
        {groupedMessages.map((item, idx) => item.type === "date-separator" ? (
          <div key={idx} style={{ textAlign: "center", margin: "10px 0", fontSize: 12, color: isDark ? "#aaa" : "#555" }}>{item.date}</div>
        ) : (
          <MessageItem
            key={item.data.id}
            id={item.data.id}
            message={item.data}
            myUid={myUid}
            isDark={isDark}
            setReplyTo={setReplyTo}
            onMediaClick={() => openMediaViewer(0)}
            onDelete={deleteMessage}
            onPin={pinMessage}
            highlight={replyTo?.id === item.data.id}
          />
        ))}
        <div ref={endRef} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        sendMediaMessage={sendMediaMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={(v) => setFriendTyping(v)}
        setShowPreview={setShowPreview}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }))}
          onRemove={(i) => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
          onClose={() => setShowPreview(false)}
          onSend={(files, caption) => sendMediaMessage(files, replyTo)}
          isDark={isDark}
        />
      )}

      {showMediaViewer && (
        <MediaViewer
          items={messages.filter(m => m.mediaUrl).map(m => ({ type: m.mediaType, url: m.mediaUrl }))}
          startIndex={mediaIndex}
          onClose={() => setShowMediaViewer(false)}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}