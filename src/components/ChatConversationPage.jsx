// src/components/ChatConversationPage.jsx
import React, { useState, useEffect, useRef, useContext, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

import ChatHeader from "./Chat/ChatHeader";
import MessageItem from "./Chat/MessageItem";
import ChatInput from "./Chat/ChatInput";
import LongPressMessageModal from "./Chat/LongPressMessageModal";
import ImagePreviewModal from "./Chat/ImagePreviewModal";
import MediaViewer from "./Chat/MediaViewer";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const FLASH_HIGHLIGHT_STYLE = `
.flash-highlight { animation: flash 1.2s ease; }
@keyframes flash {
  0% { background-color: rgba(255,255,0,0.4); }
  100% { background-color: transparent; }
}
`;

export default function ChatConversationPage() {
  const { chatId: paramChatId } = useParams();
  const navigate = useNavigate();
  const { theme, wallpaper } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const myUid = auth.currentUser?.uid || currentUser?.uid;
  const isDark = theme === "dark";

  // -------------------- REFS --------------------
  const messagesRefEl = useRef(null);
  const endRef = useRef(null);
  const messageRefs = useRef({});
  const typingTimer = useRef(null);

  // -------------------- STATES --------------------
  const [chatId, setChatId] = useState(paramChatId || null);
  const [chatInfo, setChatInfo] = useState(null);
  const [friendInfo, setFriendInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [caption, setCaption] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ open: false, startIndex: 0 });
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [friendOnline, setFriendOnline] = useState(false);
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [stickyDate, setStickyDate] = useState(null);

  // -------------------- REALTIME CHAT INFO --------------------
  useEffect(() => {
    if (!chatId) return;
    const chatRef = doc(db, "chats", chatId);
    let unsubChat, unsubFriend, unsubPinned;

    unsubChat = onSnapshot(chatRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setChatInfo({ id: snap.id, ...data });
      setIsBlocked(Boolean(data.blocked));
      setIsMuted(Boolean(data.mutedUntil && data.mutedUntil.toMillis() > Date.now()));

      const friendId = (data.participants || []).find((p) => p !== myUid);
      if (friendId) {
        const userRef = doc(db, "users", friendId);
        unsubFriend = onSnapshot(userRef, (s) => {
          if (s.exists()) {
            const fData = s.data();
            setFriendInfo({ id: s.id, ...fData });
            setFriendOnline(Boolean(fData.online));
          } else setFriendInfo(null);
        });
      }

      if (data.pinnedMessageId) {
        const pinnedRef = doc(db, "chats", chatId, "messages", data.pinnedMessageId);
        unsubPinned = onSnapshot(pinnedRef, (s) => {
          if (s.exists()) setPinnedMessage({ id: s.id, ...s.data() });
          else setPinnedMessage(null);
        });
      }

      const friendIdTyping = Object.keys(data.typing || {}).find((uid) => uid !== myUid);
      if (friendIdTyping) {
        const lastTyping = data.typing[friendIdTyping]?.toDate?.() || 0;
        setFriendTyping(Date.now() - lastTyping < 3000);
      }
    });

    return () => {
      unsubChat && unsubChat();
      unsubFriend && unsubFriend();
      unsubPinned && unsubPinned();
    };
  }, [chatId, myUid]);

  // -------------------- REALTIME MESSAGES --------------------
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

      // mark messages delivered in real-time
      docs
        .filter((m) => m.senderId !== myUid && !(m.deliveredTo || []).includes(myUid))
        .forEach((m) =>
          updateDoc(doc(db, "chats", chatId, "messages", m.id), {
            deliveredTo: arrayUnion(myUid),
          }).catch(() => {})
        );

      // scroll to bottom
      if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });

    return () => unsub();
  }, [chatId, myUid, isAtBottom]);

  // -------------------- MARK SEEN REAL-TIME --------------------
  useEffect(() => {
    if (!chatId || messages.length === 0) return;

    messages
      .filter((m) => m.senderId !== myUid && !(m.seenBy || []).includes(myUid))
      .forEach((m) =>
        updateDoc(doc(db, "chats", chatId, "messages", m.id), {
          seenBy: arrayUnion(myUid),
        }).catch(() => {})
      );

    updateDoc(doc(db, "chats", chatId), {
      [`lastSeen.${myUid}`]: serverTimestamp(),
    }).catch(() => {});
  }, [messages, chatId, myUid]);

  // -------------------- TYPING --------------------
  const setTypingFlag = useCallback(
    async (typing) => {
      if (!chatId) return;
      try {
        await updateDoc(doc(db, "chats", chatId), {
          [`typing.${myUid}`]: typing ? serverTimestamp() : null,
        });
      } catch {}
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

  // -------------------- SCROLL HANDLING --------------------
  useEffect(() => {
    const el = messagesRefEl.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setIsAtBottom(atBottom);

      const firstVisible = Array.from(el.children).find((c) => c.dataset?.type === "message");
      if (firstVisible) {
        const date = firstVisible.dataset.date;
        if (date !== stickyDate) setStickyDate(date);
      }
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [messages, stickyDate]);

  // -------------------- SEND MESSAGE --------------------
  const sendMessage = useCallback(
    async (textMsg = "", files = []) => {
      if (isBlocked) return toast.error("You cannot send messages");
      if (!textMsg && !files.length) return;
      if (isMuted) toast.info("Chat is muted");

      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempMessage = {
        id: tempId,
        senderId: myUid,
        text: textMsg,
        mediaUrls: files.map((f) => (typeof f === "string" ? f : URL.createObjectURL(f))),
        createdAt: new Date(),
        reactions: {},
        seenBy: [],
        deliveredTo: [],
        replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, senderId: replyTo.senderId } : null,
        status: "sending",
      };

      setMessages((prev) => [...prev, tempMessage]);
      if (isAtBottom) setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

      try {
        const docRef = await addDoc(collection(db, "chats", chatId, "messages"), {
          ...tempMessage,
          createdAt: serverTimestamp(),
          status: "sent",
        });

        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...tempMessage, id: docRef.id, status: "sent" } : m))
        );

        await updateDoc(doc(db, "chats", chatId), {
          lastMessage: textMsg || "Media",
          lastMessageSender: myUid,
          lastMessageAt: serverTimestamp(),
          lastMessageStatus: "delivered",
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
        toast.error("Failed to send message");
      } finally {
        setReplyTo(null);
        setText("");
      }
    },
    [chatId, myUid, isBlocked, isAtBottom, replyTo, isMuted]
  );

  // -------------------- REACTIONS --------------------
  const handleReact = useCallback(
    async (messageId, emoji) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;

      const hasReacted = msg.reactions?.[emoji]?.includes(myUid);
      const newReactions = { ...msg.reactions };
      if (!newReactions[emoji]) newReactions[emoji] = [];
      newReactions[emoji] = hasReacted
        ? newReactions[emoji].filter((uid) => uid !== myUid)
        : [...newReactions[emoji], myUid];

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: newReactions } : m))
      );

      try {
        const msgRef = doc(db, "chats", chatId, "messages", messageId);
        await updateDoc(msgRef, {
          [`reactions.${emoji}`]: hasReacted ? arrayRemove(myUid) : arrayUnion(myUid),
        });
      } catch {
        toast.error("Failed to react");
      }
    },
    [chatId, messages, myUid]
  );

  // -------------------- SCROLL TO MESSAGE --------------------
  const scrollToMessage = useCallback((id) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("flash-highlight");
    setTimeout(() => el.classList.remove("flash-highlight"), 1200);
  }, []);

  // -------------------- DATE HELPERS --------------------
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

  // -------------------- MEDIA VIEWER --------------------
  const mediaItems = useMemo(
    () =>
      messages
        .filter((m) => m.mediaUrls?.length)
        .flatMap((m) => m.mediaUrls.map((url) => ({ url, id: m.id }))),
    [messages]
  );

  const openMediaViewerAtMessage = useCallback(
    (message) => {
      const index = mediaItems.findIndex((m) => m.id === message.id);
      setMediaViewer({ open: true, startIndex: index >= 0 ? index : 0 });
    },
    [mediaItems]
  );

  // -------------------- RENDER --------------------
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
      <style>{FLASH_HIGHLIGHT_STYLE}</style>

      {/* Chat Header */}
      <ChatHeader
        chatId={chatId}
        friendId={friendInfo.id}
        pinnedMessage={pinnedMessage}
        setBlockedStatus={setIsBlocked}
        onGoToPinned={() => pinnedMessage && scrollToMessage(pinnedMessage.id)}
      />

      {/* Sticky Date */}
      {stickyDate && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            textAlign: "center",
            background: wallpaper || (isDark ? "#0b0b0b" : "#f5f5f5"),
            color: isDark ? "#888" : "#555",
            fontSize: 12,
            padding: "4px 0",
          }}
        >
          {formatDateLabel(stickyDate)}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesRefEl}
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: 8 }}
      >
        {messagesWithDateSeparators.map((item, idx) =>
          item.type === "date-separator" ? (
            <div
              key={`date-${idx}`}
              style={{ textAlign: "center", margin: "8px 0", color: isDark ? "#888" : "#555", fontSize: 12 }}
            >
              {formatDateLabel(item.date)}
            </div>
          ) : (
            <MessageItem
              key={item.data.id}
              message={item.data}
              myUid={myUid}
              isDark={isDark}
              setReplyTo={setReplyTo}
              scrollToMessage={scrollToMessage}
              openMediaViewer={openMediaViewerAtMessage}
              setLongPressMessage={setLongPressMessage}
              ref={(el) => (messageRefs.current[item.data.id] = el)}
            />
          )
        )}
        <div ref={endRef} />
      </div>

      {/* Typing & Online */}
      {(friendTyping || friendOnline) && (
        <div style={{ padding: 4, textAlign: "left", color: isDark ? "#aaa" : "#555", fontSize: 12 }}>
          {friendTyping
            ? `${friendInfo.displayName || "Friend"} is typing...`
            : `${friendInfo.displayName || "Friend"} is online`}
        </div>
      )}

      {/* Chat Input */}
      <ChatInput
        text={text}
        setText={setText}
        onSend={(t) => sendMessage(t, [])}
        onTyping={handleUserTyping}
        onMediaSelect={(files) => {
          setSelectedFiles(files);
          setShowPreview(true);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Image Preview */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          caption={caption}
          setCaption={setCaption}
          onSend={(c) => sendMessage(c, selectedFiles)}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Media Viewer */}
      {mediaViewer.open && (
        <MediaViewer
          items={mediaItems}
          startIndex={mediaViewer.startIndex}
          onClose={() => setMediaViewer({ open: false, startIndex: 0 })}
        />
      )}

      {/* Long Press Modal */}
      {longPressMessage && (
        <LongPressMessageModal
          message={longPressMessage}
          onClose={() => setLongPressMessage(null)}
          onReaction={(emoji) => handleReact(longPressMessage.id, emoji)}
          setReplyTo={setReplyTo}
        />
      )}

      <ToastContainer position="bottom-right" />
    </div>
  );
}