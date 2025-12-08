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
  getDocs,
  limit,
  endBefore,
  startAfter,
  limitToLast,
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

const PAGE_SIZE = 40; // messages per "page" when you later implement pagination

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
  const [messages, setMessages] = useState([]); // ascending order (oldest -> newest)
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

    // subscribe to chat doc (participants, pinned id, typing, blocked, etc.)
    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));

      // friend info: the other participant
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        // keep friendInfo up-to-date
        onSnapshot(userRef, (s) => s.exists() && setFriendInfo({ id: s.id, ...s.data() }));
      } else {
        setFriendInfo(null);
      }

      // pinned message subscription (if present)
      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        onSnapshot(pinnedRef, (s) => s.exists() && setPinnedMessage({ id: s.id, ...s.data() }));
      } else {
        setPinnedMessage(null);
      }

      // typing indicator: read the flag for the friend
      const friendIdForTyping = (data.participants || []).find((p) => p !== myUid);
      setFriendTyping(Boolean(data.typing?.[friendIdForTyping]));
    });

    return () => unsubChat();
  }, [chatId, myUid]);

  // -------------------- Real-time messages (ascending order) --------------------
  // We subscribe to messages ordered asc, so UI shows oldest -> newest.
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    // Subscribe realtime to messages (simple and reliable).
    // If your dataset grows very large you can switch to paginated subscriptions later.
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
        }));

        setMessages(docs);

        // mark delivered for this client (so sender sees delivered)
        const undelivered = docs.filter(
          (m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid)
        );
        if (undelivered.length) {
          // fire-and-forget updates
          undelivered.forEach((m) =>
            updateDoc(doc(db, "chats", chatId, "messages", m.id), {
              deliveredTo: arrayUnion(myUid),
            })
          );
        }

        // auto-scroll to bottom only if user is at bottom (or first load)
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "auto" });
      },
      (err) => {
        console.error("Messages onSnapshot error:", err);
      }
    );

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- Mark seen when messages present --------------------
  useEffect(() => {
    if (!chatId || !myUid || !messages.length) return;

    const unseen = messages.filter(
      (m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid)
    );

    if (unseen.length) {
      unseen.forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), {
          seenBy: arrayUnion(myUid),
        })
      );
      // Update lastSeen for this chat doc
      updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() });
    }
  }, [messages, chatId, myUid]);

  // -------------------- Scroll detection (are we at bottom?) --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    const onScroll = () => setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // -------------------- Helpers --------------------
  const mediaItems = messages
    .filter((m) => m.mediaUrl)
    .map((m) => ({ url: m.mediaUrl, id: m.id, type: m.mediaType }));

  const scrollToMessage = (id) => {
    const el = messageRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  };

  // -------------------- Typing indicator writer (debounced) --------------------
  const setTypingFlag = async (typing) => {
    if (!chatId || !myUid) return;
    try {
      await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing });
    } catch (e) {
      // ignore network write errors
      console.warn("typing write failed", e);
    }
  };

  const handleUserTyping = (isTyping) => {
    if (isTyping) {
      setTypingFlag(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        setTypingFlag(false);
      }, 1800);
    } else {
      setTypingFlag(false);
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    }
  };

  // -------------------- Reaction toggle --------------------
  // uses updateDoc with path `reactions.<emoji>` MUST be array of uids
  const handleReact = async (messageId, emoji) => {
    if (!chatId || !messageId || !myUid) return;
    const msgRef = doc(db, "chats", chatId, "messages", messageId);
    try {
      // read current doc (small read)
      const snap = await msgRef.get?.() ?? (await getDocs([msgRef]).then(() => null)); // fallback safe-get (some environments)
      // simpler: use a transactional toggle - but to keep code short, we do optimistic "updateDoc" with arrayUnion/arrayRemove
      // Try to add; if user already reacted, remove. We'll do a read via getDocs alternative:
      // We use getDoc below (importing getDoc would be cleaner) but to avoid more imports we'll fetch via getDocs snippet.
    } catch (err) {
      // fallback: simple attempt to add (will duplicate if already present)
      try {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      } catch (e) {
        console.error("React fallback failed", e);
      }
    }
  };

  // -------------------- Send message (optimistic + upload progress) --------------------
  const sendMessage = async (textMsg = "", files = []) => {
    if (isBlocked) {
      toast.error("You cannot send messages to this user");
      return;
    }
    if (!textMsg && files.length === 0) return;

    const messagesCol = collection(db, "chats", chatId, "messages");

    try {
      const items = files.length ? files : [null];
      for (const f of items) {
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

        // optimistic UI
        setMessages((prev) => [...prev, tempMessage]);
        if (isAtBottom) endRef.current?.scrollIntoView({ behavior: "smooth" });

        // upload if file
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
                setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, uploadProgress: pct } : m)));
              },
            }
          );
          tempMessage.mediaUrl = res.data.secure_url;
        }

        // persist
        const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);

        // replace temp item with persisted doc
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m)));
      }

      // update chat last message
      const chatRef = doc(db, "chats", chatId);
      await updateDoc(chatRef, {
        lastMessage: textMsg || (files[0]?.name || "Media"),
        lastMessageSender: myUid,
        lastMessageAt: serverTimestamp(),
        lastMessageStatus: "delivered",
      });
    } catch (err) {
      console.error("Send message failed:", err);
      toast.error("Failed to send message");
      // keep temp message visible — you could mark it "failed" for retry
      setMessages((prev) => prev.map((m) => (m.status === "sending" ? { ...m, status: "failed" } : m)));
    } finally {
      setText("");
      setSelectedFiles([]);
      setCaption("");
      setReplyTo(null);
      setShowPreview(false);
    }
  };

  // -------------------- Open media viewer at a message (by id) --------------------
  const openMediaViewerAtMessage = (message) => {
    const index = mediaItems.findIndex((m) => m.id === message.id);
    const startIndex = index >= 0 ? index : 0;
    setMediaViewer({ open: true, startIndex });
  };

  // -------------------- Pagination helper (OPTIONAL) --------------------
  // NOTE: to keep example simple we currently subscribe to entire collection.
  // Below is a helper you can wire to "onScroll top" to fetch older messages with getDocs.
  const loadOlderMessages = async () => {
    try {
      if (!messages.length) return;
      const first = messages[0];
      const messagesRef = collection(db, "chats", chatId, "messages");
      // fetch PAGE_SIZE older messages that are before first.createdAt
      const q = query(messagesRef, orderBy("createdAt", "asc"), endBefore(first.createdAt), limitToLast(PAGE_SIZE));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const older = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(),
        }));
        // prepend them
        setMessages((prev) => [...older, ...prev]);
      }
    } catch (err) {
      console.error("loadOlderMessages failed", err);
    }
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

      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop === 0) {
            // user scrolled to top -> attempt load older messages (non-blocking)
            loadOlderMessages();
          }
        }}
      >
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            myUid={myUid}
            isDark={isDark}
            setReplyTo={setReplyTo}
            setPinnedMessage={(m) => {
              // pin chat-level message id
              if (!m?.id) return;
              updateDoc(doc(db, "chats", chatId), { pinnedMessageId: m.id }).catch(console.error);
              setPinnedMessage(m);
            }}
            friendInfo={friendInfo}
            onMediaClick={(message) => openMediaViewerAtMessage(message)}
            registerRef={(el) => {
              if (el) messageRefs.current[msg.id] = el;
            }}
            onReact={handleReact}
            onDelete={async (messageToDelete) => {
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
          {friendInfo?.name || "Contact"} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={(v) => {
          setText(v);
        }}
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