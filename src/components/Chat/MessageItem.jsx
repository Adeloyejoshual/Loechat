import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

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

  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "❤️" });

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);
  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
  }, []);

  const renderStatus = () => {
    if (!isMine) return null;
    const total = message.totalParticipants || 2;
    const seen = message.seenBy?.length || 0;
    const delivered = message.deliveredTo?.length || 0;

    if (seen >= total - 1) return <span style={{ color: "#00e676" }}>✔✔</span>;
    if (delivered >= total - 1) return "✔✔";
    return "✔";
  };

  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";
  const reactionsEntries = Object.entries(localReactions || {});
  const senderName = isMine ? "You" : cleanName(friendInfo?.name);

  // -------------------- LONG PRESS --------------------
  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => setShowLongPress(true), LONG_PRESS_DELAY);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // -------------------- Trigger Quick Reaction Animation --------------------
  const handleReact = (emoji) => {
    onReact?.(message.id, emoji);
    setReactionAnim({ show: true, emoji });
    setTimeout(() => setReactionAnim({ show: false, emoji }), 800);
  };

  return (
    <>
      <div
        ref={containerRef}
        onTouchStart={(e) => {
          swipeStartX.current = e.touches[0].clientX;
          setSwipeActive(true);
          startLongPress();
        }}
        onTouchMove={(e) => {
          const diff = e.touches[0].clientX - swipeStartX.current;
          if (Math.abs(diff) > 10) cancelLongPress();
          if (!swipeActive) return;
          setSwipeX(Math.max(Math.min(diff, 120), -120));
        }}
        onTouchEnd={() => {
          cancelLongPress();
          if (swipeActive && Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
            setReplyTo(message);
          }
          setSwipeX(0);
          setSwipeActive(false);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          startLongPress();
        }}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
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
          userSelect: "none",
        }}
      >
        {!isMine && (
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{senderName}</div>
        )}

        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <span
                onClick={() => setVisibleChars((v) => v + READ_MORE_STEP)}
                style={{ color: "#888", cursor: "pointer" }}
              >
                ...more
              </span>
            )}
          </div>
        )}

        {message.mediaUrl && (
          <img
            src={message.mediaUrl}
            alt=""
            style={{ width: "100%", marginTop: 6, borderRadius: 12 }}
            onClick={() => onMediaClick?.(message)}
          />
        )}

        {reactionsEntries.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
            {reactionsEntries.map(([emoji, users]) => (
              <div key={emoji}>
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 6 }}>
          {formatTime(message.createdAt)} {renderStatus()}
        </div>

        {/* Quick reaction floating animation */}
        {reactionAnim.show && (
          <div
            style={{
              position: "absolute",
              top: -20,
              right: 10,
              fontSize: 20,
              animation: "floatUp 0.8s ease-out forwards",
            }}
          >
            {reactionAnim.emoji}
          </div>
        )}
      </div>

      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
          onReply={() => {
            setReplyTo(message);
            setShowLongPress(false);
          }}
          onDelete={() => {
            onDelete?.(message);
            setShowLongPress(false);
          }}
          onPin={() => {
            setPinnedMessage(message);
            setShowLongPress(false);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(message.text || "");
            setShowLongPress(false);
          }}
          onReaction={handleReact}
          messageSenderName={senderName}
        />
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
      `}</style>
    </>
  );
}