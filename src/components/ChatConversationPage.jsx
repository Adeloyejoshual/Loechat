// src/components/ChatConversationPage.jsx
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
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import MediaViewer from "./Chat/MediaViewer";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Helpers
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

  if (date.getFullYear() === today.getFullYear())
    return date.toLocaleDateString(undefined, { day: "numeric", month: "long" });

  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

const getCloudinaryUrl = (url, w = 100, h = 100) => {
  if (!url?.includes("cloudinary")) return url;
  return url.replace("/upload/", `/upload/c_fill,g_face,h_${h},w_${w}/`);
};

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid;

  const messagesWrapRef = useRef(null);
  const bottomRef = useRef(null);

  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tempMessages, setTempMessages] = useState([]); // temporary upload messages
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

  /* ---------------- Load chat & friend ---------------- */
  useEffect(() => {
    if (!chatId || !myUid) return;

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Friend info
      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const unsubFriend = onSnapshot(doc(db, "users", friendId), (u) => {
          if (u.exists()) setFriend({ id: u.id, ...u.data() });
        });
        return () => unsubFriend();
      }

      // Pinned message
      if (data.pinnedMessageId) {
        const unsubPinned = onSnapshot(
          doc(db, "chats", chatId, "messages", data.pinnedMessageId),
          (m) => m.exists() && setPinnedMessage({ id: m.id, ...m.data() })
        );
        return () => unsubPinned();
      } else {
        setPinnedMessage(null);
      }
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  /* ---------------- Load messages ---------------- */
  useEffect(() => {
    if (!chatId) return;

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      if (isAtBottom) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
      }
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  /* ---------------- Scroll detect ---------------- */
  useEffect(() => {
    const el = messagesWrapRef.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------------- Typing detection ---------------- */
  const setTypingStatus = async (isTyping) => {
    const ref = doc(db, "chats", chatId, "typing", myUid);
    await updateDoc(ref, { isTyping }).catch(() => setDoc(ref, { isTyping }));
  };

  useEffect(() => {
    if (!chatId || !friend?.id) return;

    const unsubTyping = onSnapshot(
      doc(db, "chats", chatId, "typing", friend.id),
      (snap) => setFriendTyping(snap.exists() ? snap.data()?.isTyping || false : false)
    );
    return () => unsubTyping();
  }, [chatId, friend?.id]);

  /* ---------------- Send text ---------------- */
  const sendTextMessage = async (txt, reply) => {
    if (!txt.trim()) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
      senderId: myUid,
      text: txt,
      createdAt: serverTimestamp(),
      replyTo: reply ? { id: reply.id, text: reply.text } : null,
      reactions: {},
    });
    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: txt,
      lastMessageAt: serverTimestamp(),
    });
  };

  /* ---------------- Temporary upload messages ---------------- */
  const addTempMessage = (msg) => {
    setTempMessages((prev) => [...prev, msg]);
  };

  const updateTempMessage = (id, updates) => {
    setTempMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const removeTempMessage = (id) => {
    setTempMessages((prev) => prev.filter((m) => m.id !== id));
  };

  /* ---------------- Send media ---------------- */
  const sendMediaMessage = async (files, reply, captionsMap = {}) => {
    for (const file of files) {
      const tempId = crypto.randomUUID();
      const tempMsg = {
        id: tempId,
        senderId: myUid,
        mediaUrl: URL.createObjectURL(file),
        mediaType: file.type.startsWith("image")
          ? "image"
          : file.type.startsWith("video")
          ? "video"
          : file.type.startsWith("audio")
          ? "audio"
          : "file",
        fileName: file.name,
        caption: captionsMap[file.name] || "",
        status: "uploading",
        progress: 0,
        replyTo: reply ? { id: reply.id, text: reply.text } : null,
      };
      addTempMessage(tempMsg);

      // Upload process
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          updateTempMessage(tempId, { progress });
        }
      };
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const res = JSON.parse(xhr.responseText);
          await addDoc(collection(db, "chats", chatId, "messages"), {
            senderId: myUid,
            mediaUrl: res.secure_url,
            mediaType: tempMsg.mediaType,
            fileName: file.name,
            caption: captionsMap[file.name] || "",
            encrypted: false,
            createdAt: serverTimestamp(),
            replyTo: reply ? { id: reply.id, text: reply.text } : null,
            reactions: {},
          });
          removeTempMessage(tempId);
        } else {
          updateTempMessage(tempId, { status: "error" });
        }
      };
      xhr.onerror = () => updateTempMessage(tempId, { status: "error" });
      xhr.send(formData);
    }
  };

  /* ---------------- Reactions ---------------- */
  const handleReactionToggle = async (msg, emoji) => {
    const ref = doc(db, "chats", chatId, "messages", msg.id);
    const reactions = msg.reactions || {};
    const users = reactions[emoji] || [];
    const updated = users.includes(myUid) ? users.filter((u) => u !== myUid) : [...users, myUid];
    await updateDoc(ref, { [`reactions.${emoji}`]: updated });
  };

  /* ---------------- Long press actions ---------------- */
  const deleteMessage = async (msg, type) => {
    if (type === "everyone") await deleteDoc(doc(db, "chats", chatId, "messages", msg.id));
    else
      await updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
        text: "This message was deleted",
        mediaUrl: "",
        deleted: true,
      });
    setLongPressMsg(null);
  };

  const pinMessage = async (msg) => {
    await updateDoc(doc(db, "chats", chatId), {
      pinnedMessageId: pinnedMessage?.id === msg.id ? null : msg.id,
    });
    setLongPressMsg(null);
  };

  /* ---------------- Media viewer ---------------- */
  const openMedia = (id) => {
    const media = [...messages, ...tempMessages].filter((m) => m.mediaUrl);
    setMediaItems(media.map((m) => ({ type: m.mediaType, url: m.mediaUrl, name: m.fileName })));
    setMediaIndex(media.findIndex((m) => m.id === id));
    setShowMediaViewer(true);
  };

  /* ---------------- Scroll to message ---------------- */
  const scrollToMessage = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* ---------------- Group messages ---------------- */
  const allMessages = [...messages, ...tempMessages].sort((a, b) => {
    const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || Date.now();
    const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || Date.now();
    return tA - tB;
  });

  const grouped = [];
  let lastDay = null;
  allMessages.forEach((m) => {
    const date = m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000) : new Date(m.createdAt || Date.now());
    const label = getDayLabel(date);
    if (label !== lastDay) {
      grouped.push({ type: "date", label });
      lastDay = label;
    }
    grouped.push({ type: "msg", data: m });
  });
  if (friendTyping) grouped.push({ type: "typing" });

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
        friendId={friend?.id}
        friendName={friend?.name}
        friendProfilePic={getCloudinaryUrl(friend?.profilePic, 100, 100)}
        pinnedMessage={pinnedMessage}
        onGoToPinned={() => scrollToMessage(pinnedMessage?.id)}
      />

      <div ref={messagesWrapRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {grouped.map((item, i) =>
          item.type === "date" ? (
            <div
              key={i}
              style={{ textAlign: "center", fontSize: 12, margin: "10px 0", color: isDark ? "#aaa" : "#555" }}
            >
              {item.label}
            </div>
          ) : item.type === "typing" ? (
            <div key="typing" style={{ fontStyle: "italic", fontSize: 12, margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>
              {friend?.name || "Friend"} is typing...
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              pinnedMessage={pinnedMessage}
              onOpenLongPress={setLongPressMsg}
              onSwipeRight={setReplyTo}
              onMediaClick={openMedia}
              onReactionToggle={handleReactionToggle}
              retryUpload={sendMediaMessage}
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
        setShowPreview={setShowPreview}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        isDark={isDark}
        setTyping={setTypingStatus}
        friendTyping={friendTyping}
      />

      {showMediaViewer && (
        <MediaViewer items={mediaItems} startIndex={mediaIndex} onClose={() => setShowMediaViewer(false)} />
      )}

      {longPressMsg && (
        <LongPressMessageModal
          message={longPressMsg}
          onClose={() => setLongPressMsg(null)}
          onReply={() => {
            setReplyTo(longPressMsg);
            setLongPressMsg(null);
          }}
          onPin={() => pinMessage(longPressMsg)}
          onDelete={deleteMessage}
          isPinned={pinnedMessage?.id === longPressMsg.id}
        />
      )}

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({
            file: f,
            previewUrl: URL.createObjectURL(f),
            type: f.type.startsWith("image") ? "image" : f.type.startsWith("video") ? "video" : f.type.startsWith("audio") ? "audio" : "file",
            name: f.name,
          }))}
          onClose={() => setShowPreview(false)}
          onSend={(files, captionsMap) => sendMediaMessage(files, replyTo, captionsMap)}
          isDark={isDark}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}