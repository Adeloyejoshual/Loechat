import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

// 🔒 Blocks UID from ever showing
const cleanName = (name) => {
  if (!name) return "User";
  if (typeof name !== "string") return "User";
  if (name.length > 20 && !name.includes(" ")) return "User"; // blocks Firebase UID
  return name;
};

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
  friendInfo,
  onMediaClick,
  registerRef,
  onReact,
  onDelete,
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
  const lastTap = useRef(0);
  const [showQuickReactionAnim, setShowQuickReactionAnim] = useState(false);
  const [localReactions, setLocalReactions] = useState(message.reactions || {});

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);

  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
  }, []);

  // ✅ Green Seen Tick Logic
  const renderStatus = () => {
    if (!isMine) return null;

    const total = message.totalParticipants || 2;
    const seen = message.seenBy?.length || 0;
    const delivered = message.deliveredTo?.length || 0;

    if (seen >= total - 1) return <span style={{ color: "#00e676" }}>✔✔</span>; // ✅ GREEN
    if (delivered >= total - 1) return "✔✔";
    return "✔";
  };

  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";
  const reactionsEntries = Object.entries(localReactions || {});

  const senderName = isMine ? "You" : cleanName(friendInfo?.name);

  return (
    <>
      <div
        ref={(el) => (containerRef.current = el)}
        onTouchStart={(e) => {
          swipeStartX.current = e.touches[0].clientX;
          setSwipeActive(true);
        }}
        onTouchMove={(e) => {
          if (!swipeActive) return;
          const diff = e.touches[0].clientX - swipeStartX.current;
          setSwipeX(Math.max(Math.min(diff, 120), -120));
        }}
        onTouchEnd={() => {
          if (swipeActive && Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
            setReplyTo(message);
          }
          setSwipeX(0);
          setSwipeActive(false);
        }}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          margin: "6px 0",
          padding: 12,
          borderRadius: 16,
          backgroundColor: bubbleBg,
          color: bubbleColor,
          transform: `translateX(${swipeX}px)`,
          transition: swipeX ? "none" : "transform 0.18s ease",
          wordBreak: "break-word",
          position: "relative",
        }}
      >
        {/* ✅ SENDER NAME (NO UID EVER) */}
        {!isMine && (
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>
            {senderName}
          </div>
        )}

        {/* MESSAGE */}
        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text.slice(0, visibleChars)}
          </div>
        )}

        {/* MEDIA */}
        {message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt=""
            style={{ width: "100%", marginTop: 6, borderRadius: 12 }}
            onClick={() => onMediaClick?.(message)}
          />
        )}

        {/* REACTIONS */}
        {reactionsEntries.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
            {reactionsEntries.map(([emoji, users]) => (
              <div key={emoji}>
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}

        {/* ✅ TIME + ✅ GREEN SEEN */}
        <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 6 }}>
          {formatTime(message.createdAt)} {renderStatus()}
        </div>

        {showQuickReactionAnim && <div style={{ position: "absolute", top: -10 }}>❤️</div>}
      </div>

      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
          onReply={() => setReplyTo(message)}
          onDelete={() => onDelete?.(message)}
          messageSenderName={senderName}
        />
      )}
    </>
  );
}