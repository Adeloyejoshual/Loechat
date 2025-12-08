// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  arrayUnion,
  serverTimestamp,
  getDocs,
  limit,
  endBefore,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

const PAGE_SIZE = 40;

export default function ChatConversationPage() {
  const { chatId } = useParams();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";
  const myUid = auth.currentUser?.uid || currentUser?.uid;

  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef({});
  const typingTimer = useRef(null);

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const displayedMessageIds = useRef(new Set());

  // -------------------- Load chat & friend info --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));

      // Friend info
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      } else setFriendInfo(null);

      // Pinned message
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else setPinnedMessage(null);

      // Typing indicator
      const friendIdForTyping = (data.participants || []).find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages --------------------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(PAGE_SIZE));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));

      // Filter out temp messages
      const permanentMessages = docs.filter((m) => !m.id.startsWith("temp-"));
      setMessages(permanentMessages);

      // Mark delivered
      const undelivered = permanentMessages.filter(
        (m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid)
      );
      undelivered.forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) })
      );

      // New message toast logic
      if (!isAtBottom) {
        const newMsgs = permanentMessages.filter(
          (m) => m.senderId !== myUid && !displayedMessageIds.current.has(m.id)
        );
        if (newMsgs.length > 0) setNewMessageCount((prev) => prev + newMsgs.length);
      } else {
        setNewMessageCount(0);
        endRef.current?.scrollIntoView({ behavior: "auto" });
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Mark seen --------------------
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;
    const unseen = messages.filter((m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid));
    unseen.forEach((m) =>
      updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) })
    );
    if (unseen.length) updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() });
  }, [messages, chatId, myUid]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Load older messages --------------------
  const loadOlderMessages = async () => {
    if (loadingOlder || !messages.length) return;
    setLoadingOlder(true);

    const container = messagesRefEl.current;
    const scrollHeightBefore = container.scrollHeight;

    const first = messages[0];
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"), endBefore(first.createdAt), limit(PAGE_SIZE));

    const snap = await getDocs(q);
    if (!snap.empty) {
      const older = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
      }));
      setMessages((prev) => [...older, ...prev]);

      // Preserve scroll
      setTimeout(() => {
        const scrollHeightAfter = container.scrollHeight;
        container.scrollTop = scrollHeightAfter - scrollHeightBefore;
      }, 50);
    }

    setLoadingOlder(false);
  };

  // -------------------- Typing --------------------
  const setTypingFlag = async (typing) => {
    if (!chatId || !myUid) return;
    try {
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing });
    } catch {}
  };

  const handleUserTyping = (isTyping) => {
    if (isTyping) {
      setTypingFlag(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingFlag(false), 1800);
    } else {
      setTypingFlag(false);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    }
  };

  // -------------------- Send message --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) return toast.error("You cannot send messages to this user");
    if (!textMsg && !files.length) return;

    const messagesCol = collection(db, "chats", chatId, "messages");
    const newMessages = files.length ? files : [null];

    for (const f of newMessages) {
      const isFile = Boolean(f);
      const type = isFile ? (f.type.startsWith("image/") ? "image" : "video") : null;
      const tempId = `temp-${Date.now()}-${Math.random()}`;

      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: isFile ? caption || "" : textMsg.trim(),
        mediaUrl: isFile ? URL.createObjectURL(f) : "",
        mediaType: type,
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        deliveredTo: [],
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        status: "sending",
        uploadProgress: isFile ? 0 : undefined,
      };

      setMessages((prev) => [...prev, tempMessage]);
      if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });

      if (isFile) {
        try {
          const formData = new FormData();
          formData.append("file", f);
          formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
            formData,
            {
              onUploadProgress: (ev) => {
                const pct = Math.round((ev.loaded * 100) / ev.total);
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: pct } : m))
                );
              },
            }
          );
          tempMessage.mediaUrl = res.data.secure_url;
        } catch (err) {
          toast.error("Failed to upload media");
          continue;
        }
      }

      const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
      const docRef = await addDoc(messagesCol, payload);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
      );
    }

    await updateDoc(doc(db, "chats", chatId), {
      lastMessage: textMsg || (files[0]?.name || "Media"),
      lastMessageSender: myUid,
      lastMessageAt: serverTimestamp(),
      lastMessageStatus: "delivered",
    });

    setText("");
    setSelectedFiles([]);
    setCaption("");
    setReplyTo(null);
    setShowPreview(false);
  };

  // -------------------- Media viewer --------------------
  const mediaItems = messages.filter((m) => m.mediaUrl).map((m) => ({ url: m.mediaUrl, id: m.id, type: m.mediaType }));

  const openMediaViewerAtMessage = (message) => {
    const index = mediaItems.findIndex((m) => m.id === message.id);
    setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
  };

  const scrollToMessage = (id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  };

  // -------------------- Auto-hide new message toast --------------------
  useEffect(() => {
    if (newMessageCount === 0) return;
    const timer = setTimeout(() => setNewMessageCount(0), 5000);
    return () => clearTimeout(timer);
  }, [newMessageCount]);

  // -------------------- Render --------------------
  if (!chatInfo || !friendInfo) return <div style={{ padding: 20 }}>Loading chat...</div>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "relative",
        backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
        color: isDark ? "#fff" : "#000",
      }}
    >
      <ChatHeader
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
        onViewMedia={() => setMediaViewer({ open: true, startIndex: 0 })}
      />

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
          if (el.scrollTop === 0) loadOlderMessages();
        }}
      >
        {loadingOlder && <div style={{ textAlign: "center" }}>Loading...</div>}

        {messages.map((msg) => {
          const isNew = !displayedMessageIds.current.has(msg.id);
          if (isNew) displayedMessageIds.current.add(msg.id);

          return (
            <div key={msg.id} className={isNew ? "message-fade-in" : ""}>
              <MessageItem
                message={msg}
                myUid={myUid}
                isDark={isDark}
                setReplyTo={setReplyTo}
                setPinnedMessage={(m) => {
                  if (!m?.id) return;
                  updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id }).catch(console.error);
                  setPinnedMessage(m);
                }}
                friendInfo={friendInfo}
                onMediaClick={(message) => openMediaViewerAtMessage(message)}
                registerRef={(el) => { if (el) messageRefs.current[msg.id] = el; }}
                onReact={async (msgId, emoji) => {
                  const msgRef = doc(db, "chats", chatId, "messages", msgId);
                  await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
                }}
                onDelete={async (messageToDelete) => {
                  await updateDoc(doc(db, "chats", chatId, "messages", messageToDelete.id), { deleted: true });
                }}
              />
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div style={{ padding: "0 12px 6px 12px", fontSize: 12, color: isDark ? "#ccc" : "#555" }}>
          {friendInfo?.displayName || "Contact"} is typing...
        </div>
      )}

      {/* New message toast */}
      {newMessageCount > 0 && (
        <div
          className="new-message-toast show"
          onClick={() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" });
            setNewMessageCount(0);
          }}
        >
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""}
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setShowPreview={setShowPreview}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        sendTextMessage={() => sendMessage(text, selectedFiles)}
        sendMediaMessage={(files) => sendMessage(caption, files)}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={handleUserTyping}
        caption={caption}
        setCaption={setCaption}
      />

      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((f) => ({ file: f, url: URL.createObjectURL(f) }))}
          caption={caption}
          setCaption={setCaption}
          onRemove={(i) => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          onSend={async () => {
            await sendMessage(caption, selectedFiles);
            setShowPreview(false);
            setCaption("");
          }}
          onClose={() => setShowPreview(false)}
          isDark={isDark}
        />
      )}

      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}