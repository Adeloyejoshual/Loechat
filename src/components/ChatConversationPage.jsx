import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import MediaViewer from "./Chat/MediaViewer";

/* ---------------- Utils ---------------- */

const getDayLabel = (date) => {
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const y = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (d.getTime() === t.getTime()) return "Today";
  if (d.getTime() === y.getTime()) return "Yesterday";

  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/* ---------------- Component ---------------- */

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

  const [longPressMsg, setLongPressMsg] = useState(null);

  const [mediaItems, setMediaItems] = useState([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showMediaViewer, setShowMediaViewer] = useState(false);

  const [friendTyping, setFriendTyping] = useState(false);

  /* ---------------- Load chat & friend ---------------- */

  useEffect(() => {
    if (!chatId || !myUid) return;

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const friendId = data.participants?.find((p) => p !== myUid);
      if (!friendId) return;

      const unsubFriend = onSnapshot(doc(db, "users", friendId), (u) => {
        if (u.exists()) setFriend({ id: u.id, ...u.data() });
      });

      return () => unsubFriend();
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  /* ---------------- Load messages ---------------- */

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    });

    return () => unsub();
  }, [chatId]);

  /* ---------------- Typing ---------------- */

  const setTypingStatus = async (isTyping) => {
    if (!chatId || !myUid) return;
    const ref = doc(db, "chats", chatId, "typing", myUid);
    await updateDoc(ref, { isTyping }).catch(() => setDoc(ref, { isTyping }));
  };

  useEffect(() => {
    if (!chatId || !friend?.id) return;
    return onSnapshot(
      doc(db, "chats", chatId, "typing", friend.id),
      (snap) => setFriendTyping(snap.exists() ? !!snap.data()?.isTyping : false)
    );
  }, [chatId, friend?.id]);

  /* ---------------- Send text ---------------- */

  const sendTextMessage = async (value, reply) => {
    if (!value.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: myUid,
      text: value,
      createdAt: serverTimestamp(),
      replyTo: reply ? { id: reply.id, text: reply.text } : null,
      reactions: {},
    });

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: value,
      lastMessageAt: serverTimestamp(),
    });
  };

  /* ---------------- Send media ---------------- */

  const sendMediaMessage = async (files, reply, caption = "") => {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
        { method: "POST", body: fd }
      );

      const data = await res.json();
      if (!data.secure_url) continue;

      let mediaType = "file";
      if (file.type.startsWith("image")) mediaType = "image";
      else if (file.type.startsWith("video")) mediaType = "video";
      else if (file.type.startsWith("audio")) mediaType = "audio";

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        mediaUrl: data.secure_url,
        mediaType,
        fileName: file.name,
        text: caption || "",
        createdAt: serverTimestamp(),
        replyTo: reply ? { id: reply.id, text: reply.text } : null,
        reactions: {},
      });
    }

    setSelectedFiles([]);
    setShowPreview(false);
    setReplyTo(null);
  };

  /* ---------------- Media viewer ---------------- */

  const openMedia = (id) => {
    const media = messages.filter((m) => m.mediaUrl);
    setMediaItems(media.map((m) => ({
      type: m.mediaType,
      url: m.mediaUrl,
      name: m.fileName,
    })));
    setMediaIndex(media.findIndex((m) => m.id === id));
    setShowMediaViewer(true);
  };

  /* ---------------- Group messages by date ---------------- */

  const grouped = [];
  let lastDay = null;

  messages.forEach((m) => {
    const date = m.createdAt?.seconds
      ? new Date(m.createdAt.seconds * 1000)
      : null;
    const label = getDayLabel(date);

    if (label && label !== lastDay) {
      grouped.push({ type: "date", label });
      lastDay = label;
    }

    grouped.push({ type: "msg", data: m });
  });

  /* ---------------- Render ---------------- */

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
      }}
    >
      <ChatHeader
        friendName={friend?.name}
        friendProfilePic={friend?.profilePic}
      />

      <div
        ref={messagesWrapRef}
        style={{ flex: 1, overflowY: "auto", padding: 8 }}
      >
        {grouped.map((item, i) =>
          item.type === "date" ? (
            <div
              key={`d-${i}`}
              style={{
                textAlign: "center",
                fontSize: 12,
                margin: "10px 0",
                color: isDark ? "#aaa" : "#555",
              }}
            >
              {item.label}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              onOpenLongPress={setLongPressMsg}
              onSwipeRight={setReplyTo}
              onMediaClick={openMedia}
            />
          )
        )}

        {friendTyping && (
          <div style={{ fontSize: 12, opacity: 0.6, margin: "6px 0" }}>
            {friend?.name} is typing…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput
        text={text}
        setText={setText}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setShowPreview={setShowPreview}
        sendTextMessage={sendTextMessage}
        sendMediaMessage={sendMediaMessage}
        setTyping={setTypingStatus}
        friendTyping={friendTyping}
        isDark={isDark}
      />

      {showPreview && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({
            file: f,
            previewUrl: URL.createObjectURL(f),
          }))}
          onClose={() => setShowPreview(false)}
          onSend={(files, caption) => sendMediaMessage(files, replyTo, caption)}
          isDark={isDark}
        />
      )}

      {showMediaViewer && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaIndex}
          onClose={() => setShowMediaViewer(false)}
        />
      )}

      {longPressMsg && (
        <LongPressMessageModal
          message={longPressMsg}
          onClose={() => setLongPressMsg(null)}
          onReply={() => {
            setReplyTo(longPressMsg);
            setLongPressMsg(null);
          }}
          onDelete={async (msg) => {
            await deleteDoc(doc(db, "chats", chatId, "messages", msg.id));
            setLongPressMsg(null);
          }}
        />
      )}
    </div>
  );
}