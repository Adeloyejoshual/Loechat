// src/components/ChatConversationPage.jsx
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
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import { toast, ToastContainer } from "react-toastify";
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

  // -------------------- Load chat & friend info --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    let unsubFriend = null;
    let unsubPinned = null;

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(data.blocked || false);

      // Friend info
      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        unsubFriend?.();
        unsubFriend = onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      // Pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        unsubPinned?.();
        unsubPinned = onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else {
        setPinnedMessage(null);
      }
    });

    return () => {
      unsubChat();
      unsubFriend?.();
      unsubPinned?.();
    };
  }, [chatId, myUid]);

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
        status: "sent",
      }));
      setMessages(docs);

      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (dateStr !== lastDate) acc.push({ type: "date-separator", date: dateStr, key: dateStr });
    acc.push({ type: "message", data: msg });
    return acc;
  }, []);

  const scrollToMessage = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // -------------------- Send message (optimistic UI) --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages to this user");
    if (!textMsg && files.length === 0) return;

    const messagesCol = collection(db, "chats", chatId, "messages");

    // -------------------- Media messages (parallel) --------------------
    if (files.length > 0) {
      await Promise.all(
        files.map(async (f) => {
          const type = f.type.startsWith("image/")
            ? "image"
            : f.type.startsWith("video/")
              ? "video"
              : f.type.startsWith("audio/")
                ? "audio"
                : "file";

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
            status: "sending",
            replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
          };
          setMessages((prev) => [...prev, tempMessage]);
          endRef.current?.scrollIntoView({ behavior: "smooth" });

          try {
            let mediaUrl = "";
            if (type !== "file") {
              const formData = new FormData();
              formData.append("file", f);
              formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

              const res = await axios.post(
                `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
                formData
              );
              mediaUrl = res.data.secure_url;
            }

            const payload = {
              senderId: myUid,
              text: f.name,
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
                m.id === tempId
                  ? { ...payload, id: docRef.id, status: "sent", createdAt: new Date() }
                  : m
              )
            );
          } catch (err) {
            console.error(err);
            toast.error(`Failed to send ${f.name}`);
            setMessages((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
            );
          }
        })
      );
    }

    // -------------------- Text message --------------------
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
      } catch (err) {
        console.error(err);
        toast.error("Failed to send message");
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    }

    // -------------------- Update chat last message --------------------
    try {
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: textMsg || files[0]?.name,
        lastMessageSender: myUid,
        lastMessageAt: serverTimestamp(),
        lastMessageStatus: "delivered",
      });
    } catch (err) {
      console.error(err);
    }

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
    setShowPreview(false);
  };

  // -------------------- Clear chat --------------------
  const clearChat = async () => {
    if (!window.confirm("Clear this chat?")) return;
    try {
      await Promise.all(
        messages.map((msg) =>
          updateDoc(doc(db, "chats", chatId, "messages", msg.id), { deleted: true })
        )
      );
      toast.success("Chat cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear some messages");
    }
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
        onClearChat={clearChat}
        onSearch={() => {
          const q = prompt("Search text:");
          if (!q) return;
          const results = messages.filter((m) =>
            m.text?.toLowerCase().includes(q.toLowerCase())
          );
          if (!results.length) return toast.info("No messages found");
          scrollToMessage(results[0].id);
        }}
      />

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
        {groupedMessages.map((item) =>
          item.type === "date-separator" ? (
            <div
              key={item.key}
              style={{
                textAlign: "center",
                margin: "10px 0",
                fontSize: 12,
                color: isDark ? "#aaa" : "#555",
              }}
            >
              {item.date}
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
              friendId={friendInfo?.id}
              onReplyClick={(id) => scrollToMessage(id)}
            />
          )
        )}
        <div ref={endRef} />
      </div>

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
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onSend={() => sendMessage("", selectedFiles)}
          onCancel={() => setShowPreview(false)}
          onAddFiles={() => document.getElementById("file-input")?.click()}
          isDark={isDark}
          chatId={chatId}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}