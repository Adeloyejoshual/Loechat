import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

// Utilities for date formatting
const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();
const formatDateHeader = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (date) => {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

export default function MessageItem({
  message,
  previousMessage, // NEW: previous message to compare dates
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startPress = () => {
      longPressTimer.current = setTimeout(() => setShowLongPress(true), LONG_PRESS_DELAY);
    };
    const cancelPress = () => {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    };

    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", cancelPress);
    el.addEventListener("mouseleave", cancelPress);
    el.addEventListener("touchstart", startPress, { passive: true });
    el.addEventListener("touchend", cancelPress);

    return () => {
      cancelPress();
      if (!el) return;
      el.removeEventListener("mousedown", startPress);
      el.removeEventListener("mouseup", cancelPress);
      el.removeEventListener("mouseleave", cancelPress);
      el.removeEventListener("touchstart", startPress);
      el.removeEventListener("touchend", cancelPress);
    };
  }, []);

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
    if (!swipeActive) return;
    if (Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) setReplyTo(message);
    setSwipeX(0);
    setSwipeActive(false);
  };

  const handleDoubleTapOrClick = (e) => {
    const now = Date.now();
    const dt = now - lastTap.current;
    lastTap.current = now;

    if (dt > 0 && dt < 350) {
      setShowQuickReactionAnim(true);
      setTimeout(() => setShowQuickReactionAnim(false), 700);

      const emoji = "❤️";
      setLocalReactions((prev) => {
        const users = prev[emoji] ? [...prev[emoji]] : [];
        const hasIt = users.includes(myUid);
        const nextUsers = hasIt ? users.filter((u) => u !== myUid) : [...users, myUid];
        return { ...prev, [emoji]: nextUsers };
      });
      onReact?.(message.id, emoji);
    } else if (message.mediaUrl) {
      onMediaClick?.(message);
    }
  };

  const renderStatus = () => {
    if (!isMine) return null;
    const total = message.totalParticipants || 2;
    const delivered = message.deliveredTo?.length || 0;
    const seen = message.seenBy?.length || 0;
    if (seen >= total - 1) return "✔✔";
    if (delivered >= total - 1) return "✔✔";
    return "✔";
  };

  const ReplyPreview = ({ reply }) => {
    if (!reply) return null;
    return (
      <div
        onClick={() => {
          if (reply.id) {
            const el = document.getElementById(reply.id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          opacity: 0.9,
          paddingLeft: 6,
          marginBottom: 6,
          borderLeft: `3px solid ${isMine ? "#0056b3" : "#4caf50"}`,
        }}
      >
        {reply.mediaUrl ? (
          <img
            src={reply.mediaUrl}
            alt="reply"
            style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
          />
        ) : (
          <div style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reply.text?.slice(0, 80) || "Message"}
          </div>
        )}
      </div>
    );
  };

  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";
  const reactionsEntries = Object.entries(localReactions || {});

  // ---------------- Group date header logic ----------------
  const showDateHeader =
    !previousMessage ||
    !isSameDay(previousMessage.createdAt, message.createdAt);

  return (
    <>
      {showDateHeader && (
        <div style={{ textAlign: "center", fontSize: 12, margin: "12px 0", color: isDark ? "#ccc" : "#666" }}>
          {formatDateHeader(message.createdAt)}
        </div>
      )}

      <div
        id={message.id}
        ref={(el) => {
          containerRef.current = el;
          if (el) registerRef?.(el);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          handleDoubleTapOrClick(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleDoubleTapOrClick(e);
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
          boxShadow: isMine ? "0 4px 18px rgba(0,0,0,0.12)" : "0 2px 10px rgba(0,0,0,0.06)",
        }}
      >
        {/* reply preview */}
        <ReplyPreview reply={message.replyTo} />

        {/* message text */}
        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisibleChars((p) => p + READ_MORE_STEP);
                }}
                style={{
                  marginLeft: 8,
                  background: "transparent",
                  border: "none",
                  color: isMine ? "rgba(255,255,255,0.95)" : "#1976d2",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                aria-label="Read more"
              >
                Read more
              </button>
            )}
          </div>
        )}

        {/* media */}
        {message.mediaUrl &&
          (message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt="media"
              onClick={(e) => {
                e.stopPropagation();
                onMediaClick?.(message);
              }}
              style={{
                width: "100%",
                marginTop: message.text ? 8 : 0,
                borderRadius: 12,
                cursor: "pointer",
                display: "block",
              }}
              draggable={false}
            />
          ) : (
            <video
              src={message.mediaUrl}
              controls
              style={{ width: "100%", marginTop: message.text ? 8 : 0, borderRadius: 12 }}
              onClick={(e) => e.stopPropagation()}
            />
          ))}

        {/* reactions */}
        {reactionsEntries.length > 0 && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
              animation: "reactionsIn 220ms ease",
            }}
          >
            {reactionsEntries.map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: isMine ? "rgba(255,255,255,0.12)" : "#f0f0f0",
                  color: isMine ? "#fff" : "#000",
                  fontSize: 14,
                }}
              >
                <span>{emoji}</span>
                {users.length > 1 && <span style={{ fontSize: 12, opacity: 0.85 }}>{users.length}</span>}
              </div>
            ))}
          </div>
        )}

        {/* timestamp */}
        <div style={{ fontSize: 10, opacity: 0.5, textAlign: "right", marginTop: 4 }}>
          {formatTime(message.createdAt)}
        </div>

        {/* message status */}
        {isMine && (
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 2 }}>
            {renderStatus()}
          </div>
        )}

        {showQuickReactionAnim && (
          <div
            style={{
              position: "absolute",
              top: -8,
              right: isMine ? 6 : undefined,
              left: isMine ? undefined : 6,
              pointerEvents: "none",
              fontSize: 20,
              transform: "translateY(-6px)",
              transition: "transform 250ms ease, opacity 250ms ease",
            }}
          >
            ❤️
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
          onReaction={(emoji) => {
            setLocalReactions((prev) => {
              const users = prev[emoji] ? [...prev[emoji]] : [];
              const hasIt = users.includes(myUid);
              const nextUsers = hasIt ? users.filter((u) => u !== myUid) : [...users, myUid];
              return { ...prev, [emoji]: nextUsers };
            });
            onReact?.(message.id, emoji);
            setShowLongPress(false);
          }}
          onCopy={() => {
            navigator.clipboard.writeText(message.text || "");
            setShowLongPress(false);
          }}
          onPin={() => {
            setPinnedMessage(message);
            setShowLongPress(false);
          }}
          onDelete={() => {
            onDelete?.(message);
            setShowLongPress(false);
          }}
          messageSenderName={isMine ? "You" : friendInfo?.name || "User"}
        />
      )}

      <style>{`
        @keyframes reactionsIn {
          from { transform: translateY(6px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </>
  );
}