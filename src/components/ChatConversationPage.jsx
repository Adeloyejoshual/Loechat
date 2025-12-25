// src/components/ChatConversationPage.jsx
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
  deleteDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import MediaViewer from "./Chat/MediaViewer";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import LongPressMessageModal from "./Chat/LongPressMessageModal";

import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// ------------------ Helpers ------------------
const getDayLabel = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
};

// ------------------ Component ------------------
export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesWrapRef = useRef(null);
  const bottomRef = useRef(null);

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [longPressMsg, setLongPressMsg] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [friendTyping, setFriendTyping] = useState(false);

  // ------------------ Load chat + friend ------------------
  useEffect(() => {
    if (!chatId || !myUid) return;

    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const friendId = data.participants.find((p) => p !== myUid);
      if (friendId) {
        onSnapshot(doc(db, "users", friendId), (u) => {
          if (u.exists()) setFriend({ id: u.id, ...u.data() });
        });
      }

      if (data.pinnedMessageId) {
        onSnapshot(
          doc(db, "chats", chatId, "messages", data.pinnedMessageId),
          (m) => m.exists() && setPinnedMessage({ id: m.id, ...m.data() })
        );
      } else {
        setPinnedMessage(null);
      }
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // ------------------ Load messages (asc) ------------------
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(docs);

      if (isAtBottom) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  // ------------------ Scroll detection ------------------
  useEffect(() => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToMessage = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ------------------ Group messages by day ------------------
  const grouped = [];
  let lastDay = null;
  messages.forEach((m) => {
    const d = m.createdAt?.seconds
      ? new Date(m.createdAt.seconds * 1000)
      : null;
    const label = getDayLabel(d);

    if (label !== lastDay) {
      grouped.push({ type: "date", label });
      lastDay = label;
    }

    grouped.push({ type: "msg", data: m });
  });

  // ------------------ Send text ------------------
  const sendTextMessage = async (txt, reply) => {
    if (!txt.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: myUid,
      text: txt,
      createdAt: serverTimestamp(),
      replyTo: reply ? { id: reply.id, text: reply.text } : null,
      reactions: {},
      status: "sent",
    });

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: txt,
      lastMessageAt: serverTimestamp(),
    });
  };

  // ------------------ Send media ------------------
  const sendMediaMessage = async (files, reply, caption = "") => {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
        { method: "POST", body: fd }
      );
      const { secure_url } = await res.json();

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        mediaUrl: secure_url,
        mediaType: file.type.startsWith("video") ? "video" : "image",
        text: caption,
        createdAt: serverTimestamp(),
        replyTo: reply ? { id: reply.id, text: reply.text } : null,
        reactions: {},
        status: "sent",
      });
    }
  };

  // ------------------ Long press ------------------
  const handleLongPress = (msg) => setLongPressMsg(msg);

  const deleteMessage = async (msg, type) => {
    if (type === "everyone") {
      await deleteDoc(doc(db, "chats", chatId, "messages", msg.id));
    } else {
      await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
        text: "This message was deleted",
        mediaUrl: "",
        deleted: true,
      });
    }
    setLongPressMsg(null);
  };

  const pinMessage = async (msg) => {
    await updateDoc(doc(db, "chats", chatId), {
      pinnedMessageId: pinnedMessage?.id === msg.id ? null : msg.id,
    });
    setLongPressMsg(null);
  };

  // ------------------ Media viewer ------------------
  const openMedia = (index) => {
    setMediaItems(
      messages
        .filter((m) => m.mediaUrl)
        .map((m) => ({ type: m.mediaType, url: m.mediaUrl }))
    );
    setMediaIndex(index);
    setShowMediaViewer(true);
  };

  // ------------------ Render ------------------
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5") }}>
      <ChatHeader
        friend={friend}
        pinnedMessage={pinnedMessage}
        onPinnedClick={() => scrollToMessage(pinnedMessage?.id)}
      />

      <div ref={messagesWrapRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {grouped.map((item, i) =>
          item.type === "date" ? (
            <div key={i} style={{ textAlign: "center", fontSize: 12, color: isDark ? "#aaa" : "#555", margin: "10px 0" }}>
              {item.label}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              setReplyTo={setReplyTo}
              pinnedMessage={pinnedMessage}
              onOpenLongPress={handleLongPress}
              onSwipeRight={(m) => setReplyTo(m)}
              onMediaClick={openMedia}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={sendTextMessage}
        sendMediaMessage={sendMediaMessage}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        isDark={isDark}
        setShowPreview={setShowPreview}
        disabled={false}
        friendTyping={friendTyping}
        setTyping={setFriendTyping}
      />

      {showMediaViewer && (
        <MediaViewer items={mediaItems} startIndex={mediaIndex} onClose={() => setShowMediaViewer(false)} />
      )}

      {longPressMsg && (
        <LongPressMessageModal
          message={longPressMsg}
          onClose={() => setLongPressMsg(null)}
          onReply={() => { setReplyTo(longPressMsg); setLongPressMsg(null); }}
          onPin={() => pinMessage(longPressMsg)}
          onDelete={deleteMessage}
          isPinned={pinnedMessage?.id === longPressMsg.id}
        />
      )}

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) }))}
          onClose={() => setShowPreview(false)}
          onSend={(files, caption) => sendMediaMessage(files, replyTo, caption)}
          isDark={isDark}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}