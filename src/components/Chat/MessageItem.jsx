// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import { format } from "date-fns";

export default function MessageItem({
  message,
  myUid,
  isDark = false,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  onReact,
  highlight = false,
  pinnedMessage,
  friendId,
  onOpenLongPress,
  onSwipeRight,
}) {
  const isMine = message.senderId === myUid;
  const [showReactions, setShowReactions] = useState(false);
  const refEl = useRef(null);

  // For swipe to reply
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);
  const swipeThreshold = 80; // px

  // Long press detection
  const longPressTimer = useRef(null);
  const longPressDelay = 600;

  // Register element ref
  useEffect(() => {
    // Could register for scroll or other features
  }, []);

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchMoved.current = false;

    longPressTimer.current = setTimeout(() => {
      onOpenLongPress?.(message);
    }, longPressDelay);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      touchMoved.current = true;
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (!touchMoved.current) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > swipeThreshold && onSwipeRight) {
      onSwipeRight();
    }
  };

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      onOpenLongPress?.(message);
    }, longPressDelay);
  };

  const handleMouseUp = () => {
    clearTimeout(longPressTimer.current);
  };

  const formattedTime = message.createdAt
    ? format(new Date(message.createdAt.seconds ? message.createdAt.seconds * 1000 : message.createdAt), "HH:mm")
    : "";

  return (
    <div
      ref={refEl}
      id={message.id}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 6,
        animation: highlight ? "flash-highlight 1.2s ease" : "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenLongPress?.(message);
      }}
    >
      {/* Reply preview */}
      {message.replyTo && (
        <div
          style={{
            fontSize: 12,
            color: isDark ? "#ccc" : "#555",
            marginBottom: 2,
            padding: "2px 6px",
            background: isDark ? "#333" : "#f0f0f0",
            borderRadius: 6,
            maxWidth: "80%",
            cursor: "pointer",
          }}
          onClick={() => setReplyTo?.(message.replyTo)}
        >
          ↩ {message.replyTo.text || "Media message"}
        </div>
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: "80%",
          background: isMine ? "#4a90e2" : isDark ? "#2a2a2a" : "#fff",
          color: isMine ? "#fff" : isDark ? "#eee" : "#111",
          padding: 10,
          borderRadius: 12,
          borderTopLeftRadius: isMine ? 12 : 2,
          borderTopRightRadius: isMine ? 2 : 12,
          wordBreak: "break-word",
          position: "relative",
          cursor: "pointer",
        }}
        onClick={() => setShowReactions((prev) => !prev)}
        onDoubleClick={() => onReact?.(message.id, "❤️")}
      >
        {/* Media */}
        {message.mediaUrl && message.mediaType === "image" && (
          <img
            src={message.mediaUrl}
            alt="media"
            style={{ width: "100%", borderRadius: 8, marginBottom: message.text ? 6 : 0 }}
            onClick={() => onMediaClick?.(0)}
          />
        )}
        {message.mediaUrl && message.mediaType === "video" && (
          <video
            controls
            src={message.mediaUrl}
            style={{ width: "100%", borderRadius: 8, marginBottom: message.text ? 6 : 0 }}
          />
        )}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Timestamp & read receipt */}
        <div
          style={{
            fontSize: 10,
            color: isMine ? "rgba(255,255,255,0.7)" : isDark ? "#aaa" : "#555",
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {formattedTime} {isMine && <span>{message.status}</span>}
        </div>

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  padding: "2px 6px",
                  background: isDark ? "#333" : "#f0f0f0",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  cursor: "pointer",
                  border: users.includes(myUid) ? "1px solid #4a90e2" : "none",
                }}
                onClick={() => onReact?.(message.id, emoji)}
              >
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}

        {/* Pinned */}
        {pinnedMessage?.id === message.id && (
          <div
            style={{
              position: "absolute",
              top: -10,
              right: -10,
              background: "#ffd700",
              padding: "2px 4px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: "bold",
            }}
          >
            📌
          </div>
        )}
      </div>
    </div>
  );
}