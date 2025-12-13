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
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  getDocs,
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

  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
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

  // ---------- CHAT doc listener (friend info + pinned + typing) ----------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && (data.mutedUntil.toMillis ? data.mutedUntil.toMillis() : data.mutedUntil) > Date.now()));

      // friend id
      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        const unsubUser = onSnapshot(userRef, (uSnap) => {
          if (uSnap.exists()) setFriendInfo({ id: uSnap.id, ...uSnap.data() });
        });
        // cleanup user listener separately
        return () => unsubUser();
      } else {
        setFriendInfo(null);
      }
    });

    return () => unsub();
  }, [chatId, myUid]);

  // ---------- Messages realtime subscription ----------
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data();
        // normalize createdAt to Date for UI
        const createdAt = data.createdAt?.toDate?.() || (data.createdAt instanceof Date ? data.createdAt : new Date());
        return { id: d.id, ...data, createdAt };
      });
      setMessages(docs);

      // mark delivered for new incoming messages quickly
      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), { deliveredTo: arrayUnion(myUid) }).catch(() => {})
        );

      // autoscroll for new messages
      if (isAtBottom || !initialScrollDone.current) {
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: "auto" }), 50);
        initialScrollDone.current = true;
      }
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // ---------- Mark seen when messages array changes (fast) ----------
  useEffect(() => {
    if (!chatId || !myUid || messages.length === 0) return;
    messages
      .filter((m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid))
      .forEach((m) => {
        updateDoc(doc(db, "chats", chatId, "messages", m.id), { seenBy: arrayUnion(myUid) }).catch(() => {});
      });

    updateDoc(doc(db, "chats", chatId), { [`lastSeen.${myUid}`]: serverTimestamp() }).catch(() => {});
  }, [messages, chatId, myUid]);

  // ---------- Scroll & sticky date ----------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;
    let timeout;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        setIsAtBottom(atBottom);

        const children = Array.from(el.querySelectorAll("[data-type='message']"));
        for (const child of children) {
          const rect = child.getBoundingClientRect();
          const parentRect = el.getBoundingClientRect();
          if (rect.top - parentRect.top >= 0) {
            const msgDate = child.dataset.date;
            if (msgDate !== stickyDate) setStickyDate(msgDate);
            break;
          }
        }
      }, 60);
    };

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => {
      clearTimeout(timeout);
      el.removeEventListener("scroll", onScroll);
    };
  }, [messages, stickyDate]);

  // ---------- Typing flag (professional) ----------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId || !myUid) return;
      try {
        await updateDoc(doc(db, "chats", chatId), { [`typing.${myUid}`]: typing ? serverTimestamp() : null });
      } catch (err) {
        // ignore
      }
    },
    [chatId, myUid]
  );

  useEffect(() => {
    // listen for typing updates on chat doc to show professional realtime typing
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    const unsub = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const friendId = (data.participants || []).find((p) => p !== myUid);
      const t = data.typing?.[friendId];
      if (!t) return setFriendTyping(false);
      // t may be Firestore Timestamp
      const ms = typeof t.toMillis === "function" ? t.toMillis() : new Date(t).getTime();
      setFriendTyping(Date.now() - ms < 3500); // show typing for ~3.5s after timestamp
    });
    return () => unsub();
  }, [chatId, myUid]);

  // small debounce helper for input
  const handleUserTyping = (isTyping) => {
    clearTimeout(typingTimer.current);
    if (isTyping) setTypingFlag(true);
    typingTimer.current = setTimeout(() => setTypingFlag(false), 1500);
  };

  // ---------- Helpers ----------
  const scrollToMessage = (id) => {
    const el = messageRefs.current[id];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  };

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  const messagesWithDateSeparators = useMemo(() => {
    const res = [];
    let lastDate = null;
    messages.forEach((m) => {
      const msgDate = new Date(m.createdAt).toDateString();
      if (msgDate !== lastDate) {
        res.push({ type: "date-separator", date: msgDate });
        lastDate = msgDate;
      }
      res.push({ type: "message", data: m });
    });
    return res;
  }, [messages]);

  // ---------- Media viewer ----------
  const mediaItems = useMemo(
    () =>
      messages
        .filter((m) => (m.mediaUrls && m.mediaUrls.length) || m.mediaUrl)
        .flatMap((m) => ((m.mediaUrls && m.mediaUrls.length ? m.mediaUrls : [m.mediaUrl]).map((url) => ({ url, id: m.id })))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message, index = 0) => {
      const indexOverall = mediaItems.findIndex((mi) => mi.id === message.id);
      setMediaViewer({ open: true, startIndex: Math.max(0, indexOverall + index) });
    },
    [mediaItems]
  );

  // ---------- Send message (text + media), optimistic UI ----------
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      if (isBlocked) return toast.error("You cannot send messages to this user");
      if (!textMsg.trim() && files.length === 0) return;

      const messagesCol = collection(db, "chats", chatId, "messages");

      // first handle uploads (if any) as separate messages for clarity
      if (files.length > 0) {
        for (const file of files) {
          const tempId = `temp-${Date.now()}-${Math.random()}`;
          const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";
          const tempMessage = {
            id: tempId,
            senderId: myUid,
            text: file.name,
            mediaUrl: URL.createObjectURL(file),
            mediaType: type,
            mediaUrls: [], // normalized
            createdAt: new Date(),
            reactions: {},
            seenBy: [],
            deliveredTo: [],
            replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
            status: "sending",
          };
          setMessages((prev) => [...prev, tempMessage]);
          if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);

          // upload to Cloudinary
          try {
            const formData = new FormData();
            formData.append("file", file);
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
            const mediaUrl = res.data.secure_url;
            const payload = {
              ...tempMessage,
              mediaUrl,
              mediaType: type,
              mediaUrls: [mediaUrl],
              createdAt: serverTimestamp(),
              status: "sent",
            };
            const docRef = await addDoc(messagesCol, payload);
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m)));
          } catch (err) {
            console.error("upload error", err);
            setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
            toast.error("Failed to send media");
          }
        }
      }

      // now text message (if present)
      if (textMsg.trim()) {
        const tempId = `temp-${Date.now()}-${Math.random()}`;
        const tempMessage = {
          id: tempId,
          senderId: myUid,
          text: textMsg.trim(),
          mediaUrls: [],
          createdAt: new Date(),
          reactions: {},
          seenBy: [],
          deliveredTo: [],
          replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
          status: "sending",
        };
        setMessages((prev) => [...prev, tempMessage]);
        if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);

        try {
          const payload = { ...tempMessage, createdAt: serverTimestamp(), status: "sent" };
          const docRef = await addDoc(messagesCol, payload);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...payload, id: docRef.id, createdAt: new Date() } : m)));
        } catch (err) {
          console.error("send error", err);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
          toast.error("Failed to send message");
        }
      }

      // update chat metadata
      try {
        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: textMsg || (files[0]?.name || "Media"),
          lastMessageSender: myUid,
          lastMessageAt: serverTimestamp(),
          lastMessageStatus: "delivered",
        });
      } catch (err) {
        // ignore
      }

      setShowPreview(false);
      setCaption("");
      setSelectedFiles([]);
      setReplyTo(null);
    },
    [chatId, myUid, isAtBottom, replyTo, isBlocked, isMuted]
  );

  // ---------- handle react (toggle), robust syntax ----------
  const handleReact = useCallback(
    async (messageId, emoji) => {
      // optimistic local update
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          const hasReacted = m.reactions?.[emoji]?.includes(myUid);
          const newReactions = { ...(m.reactions || {}) };
          if (!newReactions[emoji]) newReactions[emoji] = [];
          newReactions[emoji] = hasReacted ? newReactions[emoji].filter((u) => u !== myUid) : [...newReactions[emoji], myUid];
          return { ...m, reactions: newReactions };
        })
      );

      try {
        const msgRef = doc(db, "chats", chatId, "messages", messageId);
        // fetch current server state to decide
        const snap = await msgRef.get?.() || await getDocs(collection(db, "chats", chatId, "messages")).catch(() => null);
        // simpler: attempt to remove first if user already present in local state, else add
        const locally = messages.find((mm) => mm.id === messageId);
        const already = locally?.reactions?.[emoji]?.includes(myUid);
        if (already) {
          await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
        } else {
          await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
        }
      } catch (err) {
        console.error("reaction err", err);
        toast.error("Failed to react");
      }
    },
    [chatId, myUid, messages]
  );

  // ---------- scroll-to helper for pinned etc ----------
  const scrollToMessagePublic = (id) => scrollToMessage(id);

  // ---------- render ----------
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
      <style>{FLASH_HIGHLIGHT_STYLE}</style>

      <ChatHeader
        friendId={friendInfo?.id}
        chatId={chatId}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessagePublic(pinnedMessage.id)}
        onClearChat={async () => {
          if (!window.confirm("Clear chat?")) return;
          const msgsRef = collection(db, "chats", chatId, "messages");
          const snap = await getDocs(msgsRef);
          await Promise.all(snap.docs.map((m) => updateDoc(doc(db, "chats", chatId, "messages", m.id), { deleted: true })));
          setMessages([]);
          toast.success("Chat cleared");
        }}
      />

      {stickyDate && (
        <div style={{ position: "sticky", top: 0, zIndex: 5, textAlign: "center", padding: 4, fontSize: 12, color: isDark ? "#888" : "#555" }}>
          {formatDateLabel(stickyDate)}
        </div>
      )}

      <div ref={messagesRefEl} style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column" }}>
        {messagesWithDateSeparators.map((item, idx) => {
          if (item.type === "date-separator") {
            return (
              <div key={`date-${idx}`} style={{ textAlign: "center", margin: "8px 0", color: isDark ? "#888" : "#555", fontSize: 12 }}>
                {formatDateLabel(item.date)}
              </div>
            );
          } else {
            const msg = item.data;
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                myUid={myUid}
                isDark={isDark}
                setReplyTo={setReplyTo}
                setPinnedMessage={setPinnedMessage}
                onMediaClick={openMediaViewerAtMessage}
                registerRef={(el) => {
                  if (el) messageRefs.current[msg.id] = el;
                  else delete messageRefs.current[msg.id];
                }}
                onReact={handleReact}
                onOpenLongPress={(m) => setLongPressMessage(m)}
                data-date={new Date(msg.createdAt).toDateString()}
                data-type="message"
              />
            );
          }
        })}
        <div ref={endRef} />
      </div>

      {/* typing */}
      {friendTyping && (
        <div style={{ padding: "4px 12px", fontSize: 12, color: isDark ? "#ccc" : "#555" }}>
          {friendInfo?.displayName || friendInfo?.name || "Contact"} is typing...
        </div>
      )}

      <ChatInput
        text={text}
        setText={(v) => {
          setText(v);
          handleUserTyping(Boolean(v && v.length > 0));
        }}
        selectedFiles={selectedFiles}
        setSelectedFiles={setSelectedFiles}
        setShowPreview={setShowPreview}
        isDark={isDark}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        sendTextMessage={() => sendMessage(text, [])}
        sendMediaMessage={(files) => sendMessage(caption, files)}
        disabled={isBlocked}
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
            setSelectedFiles([]);
          }}
          onClose={() => setShowPreview(false)}
          isDark={isDark}
        />
      )}

      {mediaViewer.open && (
        <MediaViewer items={mediaItems} startIndex={mediaViewer.startIndex} onClose={() => setMediaViewer({ open: false, startIndex: 0 })} />
      )}

      {longPressMessage && (
        <LongPressMessageModal
          message={longPressMessage}
          myUid={myUid}
          onClose={() => setLongPressMessage(null)}
          setReplyTo={(m) => {
            setReplyTo(m);
            setLongPressMessage(null);
            setTimeout(() => scrollToMessagePublic(m.id), 200);
          }}
          setPinnedMessage={(m) => {
            setPinnedMessage(m);
            setLongPressMessage(null);
          }}
          onReactionChange={(reactions) => {
            setMessages((prev) => prev.map((mm) => (mm.id === longPressMessage.id ? { ...mm, reactions } : mm)));
            setLongPressMessage(null);
          }}
        />
      )}

      <ToastContainer position="top-center" autoClose={1500} hideProgressBar />
    </div>
  );
}