import React, { useState, useRef, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import LongPressMessageModal from "./LongPressMessageModal";
import { toast } from "react-toastify";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

const formatTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  pinnedMessage,
  onMediaClick,
  registerRef,
  onReact,
  messages,
  setMessages,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  const [showLongPress, setShowLongPress] = useState(false);
  const longPressTimer = useRef(null);

  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const isLongText = Boolean(message.text && message.text.length > visibleChars);

  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);

  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "❤️" });

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);
  useEffect(() => { if (containerRef.current) registerRef?.(containerRef.current); }, []);

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => setShowLongPress(true), LONG_PRESS_DELAY);
  };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); longPressTimer.current = null; };

  const handleReact = (emoji) => {
    onReact?.(message.id, emoji);
    setReactionAnim({ show: true, emoji });
    setTimeout(() => setReactionAnim({ show: false, emoji }), 800);
  };

  const handleDeleteForMe = () => {
    setMessages(messages.filter((m) => m.id !== message.id));
    toast.info("Message deleted for you");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  const handleDeleteForEveryone = async () => {
    await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), { deleted: true });
    setMessages(messages.filter((m) => m.id !== message.id));
    toast.success("Message deleted for everyone");
    if (pinnedMessage?.id === message.id) setPinnedMessage(null);
  };

  const mediaArray = message.mediaUrls || (message.mediaUrl ? [message.mediaUrl] : []);
  const renderMediaGrid = () => {
    if (!mediaArray.length) return null;
    const maxVisible = 4;
    const extraCount = mediaArray.length - maxVisible;
    return (
      <div style={{ display: "grid", gridTemplateColumns: mediaArray.length === 1 ? "1fr" : mediaArray.length === 2 ? "1fr 1fr" : "repeat(auto-fit, minmax(120px, 1fr))", gap: 4, marginBottom: 6 }}>
        {mediaArray.slice(0, maxVisible).map((url, idx) => (
          <div key={idx} style={{ position: "relative" }}>
            <img
              src={url}
              alt=""
              style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: 12, cursor: "pointer", opacity: message.status === "sending" ? 0.6 : 1 }}
              onClick={() => onMediaClick?.(message, idx)}
            />
          </div>
        ))}
        {extraCount > 0 && <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold", borderRadius: 12 }}>+{extraCount}</div>}
      </div>
    );
  };

  if (message.deleted || (message.deletedForMe && isMine)) return null;

  return (
    <>
      <div
        ref={containerRef}
        onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; setSwipeActive(true); startLongPress(); }}
        onTouchMove={(e) => { const diff = e.touches[0].clientX - swipeStartX.current; if (Math.abs(diff) > 10) cancelLongPress(); if (!swipeActive) return; setSwipeX(Math.max(Math.min(diff, 120), -120)); }}
        onTouchEnd={() => { cancelLongPress(); if (swipeActive && Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) setReplyTo(message); setSwipeX(0); setSwipeActive(false); }}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          margin: "6px 0",
          padding: 12,
          borderRadius: 16,
          backgroundColor: isMine ? "#007bff" : isDark ? "#222" : "#fff",
          color: isMine ? "#fff" : isDark ? "#fff" : "#000",
          transform: `translateX(${swipeX}px)`,
          transition: swipeX ? "none" : "transform 0.18s ease",
          wordBreak: "break-word",
          position: "relative",
          userSelect: "none",
        }}
      >
        {renderMediaGrid()}
        {message.text && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, marginTop: mediaArray.length ? 4 : 0 }}>{message.text.slice(0, visibleChars)}{isLongText && <span onClick={() => setVisibleChars(v => v + READ_MORE_STEP)} style={{ color: "#888", cursor: "pointer" }}>...more</span>}</div>}
        {Object.entries(localReactions || {}).length > 0 && <div style={{ marginTop: 6, display: "flex", gap: 6 }}>{Object.entries(localReactions).map(([emoji, users]) => <div key={emoji}>{emoji} {users.length}</div>)}</div>}
        <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 6 }}>{formatTime(message.createdAt)}</div>
        {reactionAnim.show && <div style={{ position: "absolute", top: -20, right: 10, fontSize: 20, animation: "floatUp 0.8s ease-out forwards" }}>{reactionAnim.emoji}</div>}
      </div>

      {/* Long press modal with integrated emoji picker */}
      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
          onReply={() => setReplyTo(message)}
          onPin={() => setPinnedMessage(message)}
          onCopy={() => { navigator.clipboard.writeText(message.text || ""); toast.success("Copied!"); }}
          onReaction={handleReact}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
          message={message}
          onMediaClick={onMediaClick}
        />
      )}

      <style>{`@keyframes floatUp {0% {opacity:1; transform:translateY(0);} 100% {opacity:0; transform:translateY(-24px);}}`}</style>
    </>
  );
}