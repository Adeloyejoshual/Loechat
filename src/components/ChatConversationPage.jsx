// src/components/ChatConversationPage.jsx
import React, { useEffect, useState, useRef, useContext, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  onSnapshot,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

const FLASH_HIGHLIGHT_STYLE = `
.flash-highlight { animation: flash 1.2s ease; }
@keyframes flash {
  0% { background-color: rgba(255,255,0,0.4); }
  100% { background-color: transparent; }
}
`;

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
  const initialScrollDone = useRef(false);

  const [chatInfo, setChatInfo] = useState({});
  const [friendInfo, setFriendInfo] = useState({});
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [friendTyping, setFriendTyping] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [stickyDate, setStickyDate] = useState(null);

  // -------------------- CHAT & FRIEND INFO --------------------
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, "chats", chatId);
    const unsubList = [];

    const unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && data.mutedUntil.toMillis() > Date.now()));

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubFriend = onSnapshot(userRef, (s) => {
          if (s.exists()) setFriendInfo({ id: s.id, ...s.data() });
        });
        unsubList.push(unsubFriend);

        setFriendTyping(Boolean(data.typing?.[friendId]));
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        const unsubPinned = onSnapshot(pinnedRef, (s) => {
          if (s.exists()) setPinnedMessage({ id: s.id, ...s.data() });
        });
        unsubList.push(unsubPinned);
      } else setPinnedMessage(null);
    });

    unsubList.push(unsubChat);
    return () => unsubList.forEach((u) => u());
  }, [chatId, myUid]);

  // -------------------- MESSAGES SUB --------------------
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date(),
      }));
      setMessages(docs);

      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) }).catch(() => {})
        );

      if (isAtBottom || !initialScrollDone.current) {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 50);
        initialScrollDone.current = true;
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- MARK SEEN --------------------
  useEffect(() => {
    if (!chatId || !myUid || messages.length === 0) return;

    messages
      .filter((m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid))
      .forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) }).catch(() => {})
      );

    updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() }).catch(() => {});
  }, [messages, chatId, myUid]);

  // -------------------- SCROLL & STICKY DATE --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    let timeout;

    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setIsAtBottom(atBottom);

        const children = Array.from(el.children).filter((c) => c.dataset?.type === "message");
        for (const child of children) {
          const rect = child.getBoundingClientRect();
          const parentRect = el.getBoundingClientRect();
          if (rect.top - parentRect.top >= 0) {
            const msgDate = child.dataset.date;
            if (msgDate !== stickyDate) setStickyDate(msgDate);
            break;
          }
        }
      }, 50);
    };

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => {
      clearTimeout(timeout);
      el.removeEventListener("scroll", onScroll);
    };
  }, [messages, stickyDate]);

  // -------------------- TYPING --------------------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId || !myUid) return;
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing ? serverTimestamp() : null });
      } catch (err) {
        console.error("Typing flag error:", err);
      }
    },
    [chatId, myUid]
  );

  const handleUserTyping = useCallback(
    (isTyping) => {
      clearTimeout(typingTimer.current);
      if (isTyping) setTypingFlag(true);
      typingTimer.current = setTimeout(() => setTypingFlag(false), 1500);
    },
    [setTypingFlag]
  );

  // -------------------- REACTIONS --------------------
  const handleReact = useCallback(
    async (messageId, emoji) => {
      console.log("Reacting to message:", messageId, "emoji:", emoji);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const hasReacted = m.reactions?.[emoji]?.includes(myUid);
          const newReactions = { ...m.reactions };
          if (!newReactions[emoji]) newReactions[emoji] = [];
          newReactions[emoji] = hasReacted
            ? newReactions[emoji].filter((uid) => uid !== myUid)
            : [...newReactions[emoji], myUid];
          return { ...m, reactions: newReactions };
        })
      );

      try {
        const msgRef = doc(db, "chats", chatId, "messages", messageId);
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      } catch {
        toast.error("Failed to react");
      }
    },
    [chatId, myUid]
  );

  // -------------------- SEND MESSAGE --------------------
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      console.log("Sending message:", textMsg, files);
      if (isBlocked) return toast.error("You cannot send messages to this user");
      if (!textMsg && files.length === 0) return;
      if (isMuted) toast.info("This chat is muted.");

      const messagesCol = collection(db, "chats", chatId, "messages");
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg?.trim() || "",
        mediaUrls: files.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))),
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        deliveredTo: [],
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        status: "sending",
        uploadProgress: 0,
      };

      setMessages((prev) => [...prev, tempMessage]);
      if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);

      try {
        const uploadedUrls = [];
        for (const file of files) {
          if (typeof file === "string") {
            uploadedUrls.push(file);
            continue;
          }
          const formData = new FormData();
          formData.append("file", file);
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
          uploadedUrls.push(res.data.secure_url);
        }

        const payload = { ...tempMessage, mediaUrls: uploadedUrls, createdAt: serverTimestamp(), status: "sent" };
        const docRef = await addDoc(messagesCol, payload);

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m))
        );

        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: textMsg || (files[0]?.name || "Media"),
          lastMessageSender: myUid,
          lastMessageAt: serverTimestamp(),
          lastMessageStatus: "delivered",
        });
      } catch (err) {
        console.error("Send message error:", err);
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
        toast.error("Failed to send message");
      } finally {
        setShowPreview(false);
        setCaption("");
        setSelectedFiles([]);
      }
    },
    [chatId, myUid, isBlocked, isAtBottom, replyTo, isMuted]
  );

  // -------------------- MEDIA --------------------
  const mediaItems = useMemo(
    () => messages.filter((m) => m.mediaUrls?.length).flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id }))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      console.log("Opening media viewer for message:", message.id);
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (el) {
      console.log("Scrolling to message:", id);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }, []);

  // -------------------- Long Press Debug --------------------
  useEffect(() => {
    if (longPressMessage) console.log("Long press modal OPEN:", longPressMessage.id);
    else console.log("Long press modal CLOSED");
  }, [longPressMessage]);

  // -------------------- RENDER --------------------
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"), color: isDark ? "#fff" : "#000", position: "relative" }}>
      <style>{FLASH_HIGHLIGHT_STYLE}</style>
      {/* ... ChatHeader, Messages, Input, Modals same as before ... */}

      {/* Long Press Message Modal */}
      {longPressMessage?.id && (
        <LongPressMessageModal
          key={longPressMessage.id}
          message={longPressMessage}
          onClose={() => {
            console.log("Closing long press modal");
            setLongPressMessage(null);
          }}
          onReaction={(emoji) => {
            console.log("Reacting via modal:", emoji);
            handleReact(longPressMessage.id, emoji);
            setLongPressMessage(null);
          }}
          onReply={() => {
            console.log("Reply via modal to:", longPressMessage.id);
            setReplyTo(longPressMessage);
            setLongPressMessage(null);
            setTimeout(() => scrollToMessage(longPressMessage.id), 200);
          }}
          onCopy={() => {
            try {
              if (longPressMessage?.text) {
                navigator.clipboard.writeText(longPressMessage.text);
                toast.success("Copied!");
              }
            } catch {}
            finally {
              setLongPressMessage(null);
            }
          }}
          onPin={async () => {
            try {
              await updateDoc(doc(db, "chats", chatId), { pinnedMessageId: longPressMessage.id });
              setPinnedMessage(longPressMessage);
              toast.success("Pinned!");
            } catch (err) {
              toast.error("Failed to pin");
            } finally {
              setLongPressMessage(null);
            }
          }}
          onDeleteForMe={() => {
            handleDeleteForMe(longPressMessage);
            setLongPressMessage(null);
          }}
          onDeleteForEveryone={() => {
            handleDeleteForEveryone(longPressMessage);
            setLongPressMessage(null);
          }}
          isDark={isDark}
          messageSenderName={longPressMessage.senderId === myUid ? "You" : friendInfo?.name}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}