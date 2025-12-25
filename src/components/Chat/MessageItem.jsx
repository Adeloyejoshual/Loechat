// src/components/Chat/MessageItem.jsx
import React, { useRef } from "react";
import { format } from "date-fns";

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  pinnedMessage,
  onOpenLongPress,
  onSwipeRight,
  onMediaClick,
}) {
  const isMine = message.senderId === myUid;

  /* ------------------ GESTURE STATE ------------------ */
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const LONG_PRESS_DELAY = 550;
  const SWIPE_DISTANCE = 70;
  const MOVE_TOLERANCE = 12;

  /* ------------------ TOUCH HANDLERS ------------------ */
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onOpenLongPress?.(message);
    }, LONG_PRESS_DELAY);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;

    if (Math.abs(dy) > MOVE_TOLERANCE) clearTimeout(longPressTimer.current);
    if (Math.abs(dx) > MOVE_TOLERANCE) clearTimeout(longPressTimer.current);
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (longPressTriggered.current) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_DISTANCE) onSwipeRight?.(message);
  };

  /* ------------------ MOUSE HANDLERS ------------------ */
  const handleMouseDown = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onOpenLongPress?.(message);
    }, LONG_PRESS_DELAY);
  };
  const handleMouseUp = () => clearTimeout(longPressTimer.current);

  /* ------------------ TIME ------------------ */
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

  /* ------------------ UI ------------------ */
  return (
    <div
      id={message.id}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenLongPress?.(message);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: 6,
        touchAction: "pan-y",
      }}
    >
      {/* Reply Preview */}
      {message.replyTo && (
        <div
          onClick={() =>
            document
              .getElementById(message.replyTo.id)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginBottom: 3,
            padding: "4px 6px",
            background: isDark ? "#333" : "#eee",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ↩ {message.replyTo.text || "Media message"}
        </div>
      )}

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
            style={{ width: "100%", borderRadius: 8, marginBottom: message.text ? 6 : 0 }}
            onClick={() => onMediaClick?.(message.id)}
          />
        )}
        {message.mediaUrl && message.mediaType === "video" && (
          <video
            src={message.mediaUrl}
            controls
            style={{ width: "100%", borderRadius: 8, marginBottom: message.text ? 6 : 0 }}
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
    </div>
  );
}