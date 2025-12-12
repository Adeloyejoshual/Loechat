// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const typingTimer = useRef(null);

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

  // -------------------- Load chat & friend info --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));

      const friendId = data.participants?.find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      // Pinned message live
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else setPinnedMessage(null);

      // Friend typing live
      const friendTypingTime = data.typing?.[data.participants.find((p) => p !== myUid)];
      setFriendTyping(Boolean(friendTypingTime && (friendTypingTime.toDate?.() || friendTypingTime).toMillis?.() + 3000 > Date.now()));
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages & delivery --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          status: "sent",
          deliveredTo: data.deliveredTo || [],
          seenBy: data.seenBy || [],
        };
      });

      setMessages(docs);

      // -------------------- Mark messages delivered --------------------
      docs
        .filter((m) => m.senderId !== myUid && !m.deliveredTo.includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deliveredTo: arrayUnion(myUid),
          })
        );

      // Scroll to bottom if at bottom
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    return () => unsub();
  }, [chatId, isAtBottom, myUid]);

  // -------------------- Mark seen --------------------
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    messages
      .filter((m) => m.senderId !== myUid && !m.seenBy.includes(myUid))
      .forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), {
          seenBy: arrayUnion(myUid),
        })
      );
  }, [messages, chatId, myUid]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Typing --------------------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId || !myUid) return;
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing ? serverTimestamp() : null });
    },
    [chatId, myUid]
  );

  const handleTyping = (isTyping) => {
    clearTimeout(typingTimer.current);
    if (isTyping) setTypingFlag(true);
    typingTimer.current = setTimeout(() => setTypingFlag(false), 1500);
  };

  // -------------------- Date helpers --------------------
  const formatDateLabel = (date) => {
    const msgDate = new Date(date);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    if (msgDate.toDateString() === now.toDateString()) return "Today";
    if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";

    const options = { month: "short", day: "numeric" };
    if (msgDate.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return msgDate.toLocaleDateString(undefined, options);
  };

  const messagesWithDates = useMemo(() => {
    const res = [];
    let lastDate = null;
    messages.forEach((m) => {
      const dateStr = formatDateLabel(m.createdAt);
      if (dateStr !== lastDate) res.push({ type: "date-separator", date: dateStr });
      res.push({ type: "message", data: m });
      lastDate = dateStr;
    });
    return res;
  }, [messages]);

  const scrollToMessage = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // -------------------- Send message --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages");

    const messagesCol = collection(db, "chats", chatId);

    // -------------------- Handle files --------------------
    for (let f of files) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const type = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "file";

      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: f.name,
        mediaUrl: URL.createObjectURL(f),
        mediaType: type,
        createdAt: new Date(),
        status: "sending",
        replyTo: replyTo || null,
        reactions: {},
        deliveredTo: [],
        seenBy: [],
      };
      setMessages((prev) => [...prev, tempMessage]);

      try {
        let mediaUrl = tempMessage.mediaUrl;
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
          replyTo: replyTo || null,
          reactions: {},
          deliveredTo: [],
          seenBy: [],
        };

        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date(), status: "sent" } : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    }

    // -------------------- Text message --------------------
    if (textMsg.trim()) {
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg.trim(),
        createdAt: new Date(),
        status: "sending",
        replyTo: replyTo || null,
        reactions: {},
        deliveredTo: [],
        seenBy: [],
      };
      setMessages((prev) => [...prev, tempMessage]);

      try {
        const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    }

    setText("");
    setSelectedFiles([]);
    setReplyTo(null);
    setShowPreview(false);

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: textMsg || files[0]?.name,
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
    });
  };

  // -------------------- React to message --------------------
  const reactToMessage = async (messageId, emoji) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;

    const hasReacted = msg.reactions?.[emoji]?.includes(myUid);
    const updatedReactions = { ...msg.reactions };
    if (!updatedReactions[emoji]) updatedReactions[emoji] = [];
    updatedReactions[emoji] = hasReacted
      ? updatedReactions[emoji].filter((uid) => uid !== myUid)
      : [...updatedReactions[emoji], myUid];

    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedReactions } : m)));

    try {
      const msgRef = doc(db, "chats", chatId, "messages", messageId);
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(myUid) : arrayUnion(myUid),
      });
    } catch {
      toast.error("Failed to react");
    }
  };

  // -------------------- Pin message --------------------
  const pinMessage = async (messageId) => {
    try {
      await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: messageId });
      toast.success("Message pinned");
    } catch {
      toast.error("Failed to pin message");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5") }}>
      <ChatHeader
        friendId={friendInfo?.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && document.getElementById(pinnedMessage.id)?.scrollIntoView({ behavior: "smooth" })}
      />

      {/* Messages */}
      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}>
        {messagesWithDates.map((item, idx) =>
          item.type === "date-separator" ? (
            <div key={idx} style={{ textAlign: "center", margin: "8px 0", fontSize: 12, color: isDark ? "#aaa" : "#555" }}>
              {item.date}
            </div>
          ) : (
            <div key={item.data.id} id={item.data.id} style={{ alignSelf: item.data.senderId === myUid ? "flex-end" : "flex-start", marginBottom: 6 }}>
              {/* Message bubble */}
              {item.data.text && <div style={{ padding: "6px 10px", borderRadius: 8, backgroundColor: item.data.senderId === myUid ? "#0b93f6" : isDark ? "#222" : "#e5e5e5", color: item.data.senderId === myUid ? "#fff" : "#000", maxWidth: "70%", wordBreak: "break-word" }}>{item.data.text}</div>}
              {/* Media */}
              {item.data.mediaUrl && item.data.mediaType === "image" && <img src={item.data.mediaUrl} alt="media" style={{ marginTop: 4, borderRadius: 8, maxWidth: "70%" }} />}
              {item.data.mediaUrl && item.data.mediaType === "video" && <video src={item.data.mediaUrl} controls style={{ marginTop: 4, borderRadius: 8, maxWidth: "70%" }} />}
              {/* Reactions */}
              {item.data.reactions && Object.keys(item.data.reactions).length > 0 && (
                <div style={{ display: "flex", marginTop: 2 }}>
                  {Object.entries(item.data.reactions).map(([emoji, users]) => (
                    <div key={emoji} onClick={() => reactToMessage(item.data.id, emoji)} style={{ marginRight: 4, cursor: "pointer", fontSize: 14, background: "#eee", borderRadius: 4, padding: "0 4px" }}>
                      {emoji} {users.length}
                    </div>
                  ))}
                </div>
              )}
              {/* Delivered/Seen */}
              {item.data.senderId === myUid && (
                <div style={{ fontSize: 10, color: isDark ? "#aaa" : "#555", marginTop: 2 }}>
                  {item.data.seenBy.length > 0 ? "Seen" : item.data.deliveredTo.length > 0 ? "Delivered" : "Sent"}
                </div>
              )}
              {/* Pin button */}
              <button onClick={() => pinMessage(item.data.id)} style={{ fontSize: 10, marginTop: 2 }}>Pin</button>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Typing indicator */}
      {friendTyping && <div style={{ padding: 4, fontSize: 12, color: isDark ? "#aaa" : "#555" }}>{friendInfo?.displayName || "Friend"} is typing...</div>}

      {/* Chat input */}
      <ChatInput text={text} setText={setText} sendTextMessage={() => sendMessage(text, selectedFiles)} sendMediaMessage={(files) => sendMessage("", files)} selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} isDark={isDark} setShowPreview={setShowPreview} replyTo={replyTo} setReplyTo={setReplyTo} onTyping={handleTyping} disabled={isBlocked} />

      {showPreview && selectedFiles.length > 0 && <ImagePreviewModal files={selectedFiles} onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))} onSend={() => sendMessage("", selectedFiles)} onCancel={() => setShowPreview(false)} isDark={isDark} />}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}