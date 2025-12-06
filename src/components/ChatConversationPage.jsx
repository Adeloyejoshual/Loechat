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
  arrayUnion,
  arrayRemove,
  getDoc,
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
        // subscribe once (keeps updating friendInfo)
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      }

      // pinned message subscription
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else setPinnedMessage(null);

      // typing indicator (friend's typing flag)
      const friendIdForTyping = data.participants?.find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    return () => unsubChat();
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
      }));

      setMessages(docs);

      // mark delivered (for this client)
      const undelivered = docs.filter(
        (m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid)
      );
      if (undelivered.length) {
        undelivered.forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deliveredTo: arrayUnion(myUid),
          })
        );
      }

      // if user at bottom -> autoscroll to last
      if (isAtBottom) {
        // use immediate scroll on snapshot to ensure last message visible
        endRef.current?.scrollIntoView({ behavior: "auto" });
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Mark seen --------------------
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;

    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );

    if (unseen.length) {
      unseen.forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) })
      );
      updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() });
    }
  }, [messages, chatId, myUid]);

  // -------------------- Scroll detection --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () =>
      setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Helpers --------------------
  const mediaItems = messages.filter((m) => m.mediaUrl).map((m) => ({ url: m.mediaUrl, id: m.id, type: m.mediaType }));

  const scrollToMessage = (id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  };

  // -------------------- Typing (write) --------------------
  // `setTyping(true)` when user types; it writes to chat doc typing.{myUid} = true
  // it will auto-clear after idleTimeout (2s).
  const setTyping = async (isTyping) => {
    if (!chatId || !myUid) return;
    try {
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: isTyping });
    } catch (e) {
      // ignore write failures silently
      console.error("Typing state write failed", e);
    }
  };

  // expose a debounced caller to pass into ChatInput
  const handleUserTyping = (typing) => {
    // if typing true -> write true and reset timer
    if (typing) {
      // set true immediately
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        setTyping(false);
      }, 2000);
    } else {
      // explicit false
      setTyping(false);
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    }
  };

  // -------------------- Reaction persistence --------------------
  // toggles the emoji reaction for current user on message
  const handleReact = async (messageId, emoji) => {
    if (!chatId || !messageId || !myUid) return;
    const msgRef = doc(db, "chats", chatId, "messages", messageId);

    try {
      // fetch current message reaction map
      const snap = await getDoc(msgRef);
      if (!snap.exists()) return;

      const m = snap.data();
      const reactions = m.reactions || {};
      const users = reactions[emoji] || [];
      const hasReacted = users.includes(myUid);

      if (hasReacted) {
        // remove
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      } else {
        // add
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      }
    } catch (err) {
      console.error("Failed to react:", err);
      throw err;
    }
  };

  // -------------------- Send messages (with upload progress) --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) {
      toast.error("You cannot send messages to this user");
      return;
    }
    if (!textMsg && files.length === 0) return;

    const messagesCol = collection(db, "chats", chatId, "messages");

    try {
      // handle files (if provided) or just a single text message
      const items = files.length ? files : [null];
      for (const f of items) {
        const isFile = Boolean(f);
        const type = isFile ? (f.type.startsWith("image/") ? "image" : "video") : null;
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // create temporary message with optional uploadProgress
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

        // optimistic UI
        setMessages((prev) => [...prev, tempMessage]);
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });

        // If file: upload to Cloudinary with progress updates
        if (isFile) {
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
        }

        // persist final message
        const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);

        // replace temp message in UI with persisted
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
        );
      }

      // update last message on chat doc
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: textMsg || (selectedFiles[0]?.name || "Media"),
        lastMessageSender: myUid,
        lastMessageAt: serverTimestamp(),
        lastMessageStatus: "delivered",
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to send message");
    } finally {
      // reset local states
      setText("");
      setSelectedFiles([]);
      setCaption("");
      setReplyTo(null);
      setShowPreview(false);
    }
  };

  // -------------------- open media viewer at correct index --------------------
  const openMediaViewerAtMessage = (message) => {
    const index = mediaItems.findIndex((m) => m.id === message.id);
    const startIndex = index >= 0 ? index : 0;
    setMediaViewer({ open: true, startIndex });
  };

  // -------------------- render --------------------
  if (!chatInfo || !friendInfo) return <div style={{ padding: 20 }}>Loading chat...</div>;

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
        friendId={friendInfo.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
      />

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}>
        {messages.map((msg, index) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            setReplyTo={setReplyTo}
            setPinnedMessage={setPinnedMessage}
            friendInfo={friendInfo}
            onMediaClick={(message) => openMediaViewerAtMessage(message)}
            registerRef={(el) => { if (el) messageRefs.current[msg.id] = el; }}
            onReact={handleReact}
            onDelete={async (messageToDelete) => {
              // soft delete example: mark deleted flag
              try {
                await updateDoc(doc(db, "chats", chatId, "messages", messageToDelete.id), { deleted: true });
              } catch (err) {
                console.error("Delete failed", err);
              }
            }}
          />
        ))}
        <div ref={endRef} />
      </div>

      {friendTyping && (
        <div style={{ padding: "0 12px 6px 12px", fontSize: 12, color: isDark ? "#ccc" : "#555" }}>
          {friendInfo?.name} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={setText}
        sendTextMessage={() => sendMessage(text, selectedFiles)}
        sendMediaMessage={(files) => sendMessage(caption, files)}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        isDark={isDark}
        setShowPreview={setShowPreview}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        disabled={isBlocked}
        friendTyping={friendTyping}
        setTyping={(typing) => handleUserTyping(typing)}
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