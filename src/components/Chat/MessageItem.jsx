import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

/* ------------------ DATE UTILS ------------------ */
const isSameDay = (a, b) =>
  a && b && new Date(a).toDateString() === new Date(b).toDateString();

const formatDateHeader = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

/* ------------------ COMPONENT ------------------ */
export default function MessageItem({
  message,
  previousMessage,
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
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [showQuickReactionAnim, setShowQuickReactionAnim] = useState(false);
  const [localReactions, setLocalReactions] = useState(message.reactions || {});

  const longPressTimer = useRef(null);
  const swipeStartX = useRef(0);
  const lastTap = useRef(0);

  const isLongText = message.text && message.text.length > visibleChars;

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);

  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
  }, []);

  /* ---------------- LONG PRESS ---------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const start = () =>
      (longPressTimer.current = setTimeout(
        () => setShowLongPress(true),
        LONG_PRESS_DELAY
      ));

    const cancel = () => clearTimeout(longPressTimer.current);

    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", cancel);

    return () => {
      cancel();
      el.removeEventListener("mousedown", start);
      el.removeEventListener("mouseup", cancel);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchend", cancel);
    };
  }, []);

  /* ---------------- SWIPE ---------------- */
  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
  };

  const handleTouchMove = (e) => {
    if (!swipeActive) return;
    const diff = e.touches[0].clientX - swipeStartX.current;
    setSwipeX(Math.max(Math.min(diff, 120), -120));
  };

  const handleTouchEnd = () => {
    if (Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) setReplyTo(message);
    setSwipeX(0);
    setSwipeActive(false);
  };

  /* ---------------- DOUBLE TAP ---------------- */
  const handleDoubleTapOrClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) {
      setShowQuickReactionAnim(true);
      setTimeout(() => setShowQuickReactionAnim(false), 700);
      onReact?.(message.id, "❤️");
    }
    lastTap.current = now;
  };

  /* ---------------- ✅ GREEN SEEN TICKS ---------------- */
  const renderStatus = () => {
    if (!isMine) return null;

    const delivered = message.deliveredTo?.length || 0;
    const seen = message.seenBy?.length || 0;

    if (seen > 0) return <span style={{ color: "#25D366" }}>✔✔</span>; // ✅ GREEN
    if (delivered > 0) return <span style={{ color: "#aaa" }}>✔✔</span>;
    return <span style={{ color: "#aaa" }}>✔</span>;
  };

  /* ---------------- DATE GROUP HEADER ---------------- */
  const showDateHeader =
    !previousMessage || !isSameDay(previousMessage?.createdAt, message.createdAt);

  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";
  const reactionsEntries = Object.entries(localReactions || {});

  return (
    <>
      {showDateHeader && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            margin: "12px 0",
            color: isDark ? "#ccc" : "#666",
          }}
        >
          {formatDateHeader(message.createdAt)}
        </div>
      )}

      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleDoubleTapOrClick}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "80%",
          margin: "6px 0",
          padding: 12,
          borderRadius: 16,
          backgroundColor: bubbleBg,
          color: bubbleColor,
          transform: `translateX(${swipeX}px)`,
          transition: "transform 0.2s",
        }}
      >
        {/* MESSAGE TEXT */}
        {message.text &&
          !/^[A-Za-z0-9_-]{20,}$/.test(message.text.trim()) && (
            <div style={{ whiteSpace: "pre-wrap" }}>
              {message.text.slice(0, visibleChars)}
              {isLongText && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleChars((p) => p + READ_MORE_STEP);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: isMine ? "#fff" : "#1976d2",
                    fontWeight: 600,
                    marginLeft: 6,
                    cursor: "pointer",
                  }}
                >
                  Read more
                </button>
              )}
            </div>
          )}

        {/* MEDIA */}
        {message.mediaUrl &&
          (message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt=""
              onClick={() => onMediaClick?.(message)}
              style={{ width: "100%", borderRadius: 12, marginTop: 8 }}
            />
          ) : (
            <video
              src={message.mediaUrl}
              controls
              style={{ width: "100%", borderRadius: 12, marginTop: 8 }}
            />
          ))}

        {/* REACTIONS */}
        {reactionsEntries.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
            {reactionsEntries.map(([emoji, users]) => (
              <div key={emoji} style={{ fontSize: 13 }}>
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}

        {/* ✅ TIME + ✅ GREEN SEEN */}
        <div
          style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: 6,
            textAlign: "right",
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            alignItems: "center",
          }}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isMine && renderStatus()}
        </div>
      </div>

      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
          onReply={() => {
            setReplyTo(message);
            setShowLongPress(false);
          }}
          onReaction={(emoji) => onReact?.(message.id, emoji)}
          onCopy={() => navigator.clipboard.writeText(message.text || "")}
          onPin={() => setPinnedMessage(message)}
          onDelete={() => onDelete?.(message)}
          messageSenderName={isMine ? "You" : friendInfo?.name || "User"}
        />
      )}
    </>
  );
}