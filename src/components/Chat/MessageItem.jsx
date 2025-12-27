// src/components/Chat/MessageItem.jsx
import React, { useRef } from "react";
import { format } from "date-fns";

export default function MessageItem({
  message,
  myUid,
  isDark,
  pinnedMessage,
  onOpenLongPress,
  onSwipeRight,
  onMediaClick,
  onReactionToggle, // ✅ NEW
}) {
  const isMine = message.senderId === myUid;
  const msgRef = useRef(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const LONG_PRESS_DELAY = 550;
  const SWIPE_DISTANCE = 70;
  const MOVE_TOLERANCE = 12;

  /* ---------------- TOUCH ---------------- */
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (msgRef.current) {
        onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
      }
    }, LONG_PRESS_DELAY);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (longPressTriggered.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_DISTANCE) onSwipeRight?.(message);
  };

  /* ---------------- MOUSE ---------------- */
  const handleMouseDown = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (msgRef.current) {
        onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
      }
    }, LONG_PRESS_DELAY);
  };

  const handleMouseUp = () => clearTimeout(longPressTimer.current);

  /* ---------------- TIME ---------------- */
  const formattedTime = message.createdAt
    ? format(
        new Date(
          message.createdAt.seconds
            ? message.createdAt.seconds * 1000
            : message.createdAt
        ),
        "HH:mm"
      )
    : "";

  return (
    <div
      id={message.id}
      ref={msgRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (msgRef.current) {
          onOpenLongPress?.(message, msgRef.current.getBoundingClientRect());
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 8,
        touchAction: "pan-y",
      }}
    >
      {/* Message Bubble */}
      <div
        style={{
          maxWidth: "80%",
          padding: 10,
          borderRadius: 12,
          background: isMine
            ? "#4a90e2"
            : isDark
            ? "#2a2a2a"
            : "#fff",
          color: isMine ? "#fff" : isDark ? "#eee" : "#111",
          position: "relative",
        }}
      >
        {/* Media */}
        {message.mediaUrl && message.mediaType === "image" && (
          <img
            src={message.mediaUrl}
            alt=""
            style={{ width: "100%", borderRadius: 8, marginBottom: 6 }}
            onClick={() => onMediaClick?.(message.id)}
          />
        )}

        {message.mediaUrl && message.mediaType === "video" && (
          <video
            src={message.mediaUrl}
            controls
            style={{ width: "100%", borderRadius: 8, marginBottom: 6 }}
          />
        )}

        {/* Text */}
        {message.text && <div>{message.text}</div>}

        {/* Time */}
        <div
          style={{
            fontSize: 10,
            textAlign: "right",
            opacity: 0.7,
            marginTop: 4,
          }}
        >
          {formattedTime}
        </div>

        {/* Pinned */}
        {pinnedMessage?.id === message.id && (
          <div
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              fontSize: 12,
            }}
          >
            📌
          </div>
        )}
      </div>

      {/* ✅ REACTIONS (UNDER MESSAGE, CLICKABLE) */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 4,
            flexWrap: "wrap",
            alignSelf: isMine ? "flex-end" : "flex-start",
          }}
        >
          {Object.entries(message.reactions).map(([emoji, users]) => {
            const reacted = users.includes(myUid);
            return (
              <button
                key={emoji}
                onClick={() => onReactionToggle?.(message, emoji)}
                style={{
                  padding: "3px 8px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  background: reacted
                    ? "#4a90e2"
                    : isDark
                    ? "#333"
                    : "#eee",
                  color: reacted ? "#fff" : isDark ? "#eee" : "#111",
                  fontSize: 12,
                }}
              >
                {emoji} {users.length}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}