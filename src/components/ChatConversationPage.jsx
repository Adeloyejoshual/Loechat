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

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------------- Helpers ---------------- */
const getDayLabel = (date) => {
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
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
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [longPressMsg, setLongPressMsg] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  /* ---------------- Load chat & friend ---------------- */
  useEffect(() => {
    if (!chatId || !myUid) return;

    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        onSnapshot(doc(db, "users", friendId), (u) => {
          u.exists() && setFriend({ id: u.id, ...u.data() });
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

    return () => unsub();
  }, [chatId, myUid]);

  /* ---------------- Load messages ---------------- */
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      if (isAtBottom) {
        setTimeout(() => bottomRef.current?.scrollIntoView(), 40);
      }
    });

    return () => unsub();
  }, [chatId, isAtBottom]);

  /* ---------------- Scroll detect ---------------- */
  useEffect(() => {
    const el = messagesWrapRef.current;
    if (!el) return;

    const onScroll = () => {
      setIsAtBottom(
        el.scrollHeight - el.scrollTop - el.clientHeight < 80
      );
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToMessage = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  /* ---------------- Group by date ---------------- */
  const grouped = [];
  let lastDay = null;

  messages.forEach((m) => {
    const date = m.createdAt?.seconds
      ? new Date(m.createdAt.seconds * 1000)
      : null;
    const label = getDayLabel(date);

    if (label !== lastDay) {
      grouped.push({ type: "date", label });
      lastDay = label;
    }
    grouped.push({ type: "msg", data: m });
  });

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
      const { secure_url } = await res.json();

      await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId: myUid,
        mediaUrl: secure_url,
        mediaType: file.type.startsWith("video") ? "video" : "image",
        text: caption,
        createdAt: serverTimestamp(),
        replyTo: reply ? { id: reply.id, text: reply.text } : null,
        reactions: {},
      });
    }
  };

  /* ---------------- Reactions (TOGGLE) ---------------- */
  const handleReactionToggle = async (msg, emoji) => {
    const ref = doc(db, "chats", chatId, "messages", msg.id);
    const reactions = msg.reactions || {};
    const users = reactions[emoji] || [];

    const updated = users.includes(myUid)
      ? users.filter((u) => u !== myUid)
      : [...users, myUid];

    await updateDoc(ref, {
      [`reactions.${emoji}`]: updated,
    });
  };

  /* ---------------- Long press actions ---------------- */
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

  /* ---------------- Media viewer ---------------- */
  const openMedia = (id) => {
    const media = messages.filter((m) => m.mediaUrl);
    setMediaItems(media.map((m) => ({ type: m.mediaType, url: m.mediaUrl })));
    setMediaIndex(media.findIndex((m) => m.id === id));
    setShowMediaViewer(true);
  };

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
        friend={friend}
        pinnedMessage={pinnedMessage}
        onPinnedClick={() => scrollToMessage(pinnedMessage?.id)}
      />

      <div ref={messagesWrapRef} style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {grouped.map((item, i) =>
          item.type === "date" ? (
            <div
              key={i}
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
              pinnedMessage={pinnedMessage}
              onOpenLongPress={setLongPressMsg}
              onSwipeRight={setReplyTo}
              onMediaClick={openMedia}
              onReactionToggle={handleReactionToggle}
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
      />

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
          }))}
          onClose={() => setShowPreview(false)}
          onSend={(files, caption) =>
            sendMediaMessage(files, replyTo, caption)
          }
          isDark={isDark}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}