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
  reactions = {}, // pass reactions to show live
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

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (msgRef.current) {
        const rect = msgRef.current.getBoundingClientRect();
        onOpenLongPress?.(message, rect);
      }
    }, LONG_PRESS_DELAY);
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    if (Math.abs(dy) > MOVE_TOLERANCE || Math.abs(dx) > MOVE_TOLERANCE) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current);
    if (longPressTriggered.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > SWIPE_DISTANCE) onSwipeRight?.(message);
  };

  const handleMouseDown = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (msgRef.current) {
        const rect = msgRef.current.getBoundingClientRect();
        onOpenLongPress?.(message, rect);
      }
    }, LONG_PRESS_DELAY);
  };
  const handleMouseUp = () => clearTimeout(longPressTimer.current);

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
          const rect = msgRef.current.getBoundingClientRect();
          onOpenLongPress?.(message, rect);
        }
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

        {/* Reactions */}
        {reactions && Object.keys(reactions).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <div
                key={emoji}
                style={{
                  padding: "2px 6px",
                  background: "#eee",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {emoji} {users.length}
              </div>
            ))}
          </div>
        )}

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