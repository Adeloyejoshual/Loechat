// src/components/Chat/MessageItem.jsx
import React, { useState, useRef } from "react";
import LongPressMessageModal from "./LongPressMessageModal";
import MediaViewer from "./MediaViewer";

export default function MessageItem({
  message,
  myUid,
  isDark = false,
  setReplyTo,
  onReaction = () => {},
  onDeleteMessage = () => {},
  onPinMessage = () => {},
}) {
  const [showLongPress, setShowLongPress] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [showSwipeActions, setShowSwipeActions] = useState(false);

  const touchStartX = useRef(0);
  const touchStartTime = useRef(0);
  const messageRef = useRef(null);

  // Detect long press (500ms)
  const handleTouchStart = (e) => {
    touchStartTime.current = Date.now();
    touchStartX.current = e.touches[0].clientX;
    const timer = setTimeout(() => setShowLongPress(true), 500);
    messageRef.current._longPressTimer = timer;
  };

  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0) setSwipeX(dx);
  };

  const handleTouchEnd = () => {
    clearTimeout(messageRef.current._longPressTimer);

    if (Math.abs(swipeX) > 60) {
      setShowSwipeActions(true);
    } else {
      setShowSwipeActions(false);
      setSwipeX(0);
    }
  };

  // Media array (support multiple images/videos per message)
  const mediaItems = Array.isArray(message.media)
    ? message.media.map((m) => ({ url: m.url, type: m.type }))
    : message.mediaUrl
    ? [{ url: message.mediaUrl, type: message.mediaType }]
    : [];

  return (
    <div
      ref={messageRef}
      style={{
        position: "relative",
        margin: "6px 0",
        display: "flex",
        justifyContent: message.senderId === myUid ? "flex-end" : "flex-start",
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowLongPress(true);
      }}
    >
      {/* Message Bubble */}
      <div
        style={{
          backgroundColor:
            message.senderId === myUid
              ? isDark
                ? "#4caf50"
                : "#1976d2"
              : isDark
              ? "#333"
              : "#eee",
          color: message.senderId === myUid ? "#fff" : "#000",
          padding: "8px 12px",
          borderRadius: 12,
          maxWidth: "75%",
          transform: `translateX(${swipeX}px)`,
          transition: showSwipeActions ? "transform 0.2s ease" : "none",
          cursor: mediaItems.length ? "pointer" : "default",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
        onClick={() => mediaItems.length && setShowMediaViewer(true)}
      >
        {/* Render Media */}
        {mediaItems.map((m, idx) => (
          m.type === "image" ? (
            <img
              key={idx}
              src={m.url}
              alt="media"
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          ) : (
            <video
              key={idx}
              src={m.url}
              controls
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          )
        ))}

        {/* Text */}
        {message.text && <div>{message.text}</div>}
      </div>

      {/* Swipe Actions */}
      {showSwipeActions && swipeX < 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            paddingRight: 8,
          }}
        >
          {[
            { emoji: "💗", action: "like", bg: "#ff6b81" },
            { emoji: "😂", action: "haha", bg: "#ffb142" },
            { emoji: "↩️", action: "reply", bg: "#1e90ff" },
          ].map((item, i) => {
            const opacity = Math.min(Math.max((Math.abs(swipeX) - i * 30) / 60, 0), 1);
            return (
              <button
                key={i}
                onClick={() => {
                  if (item.action === "reply") setReplyTo(message);
                  else onReaction(message.id, item.emoji);
                  setShowSwipeActions(false);
                  setSwipeX(0);
                }}
                style={{
                  backgroundColor: item.bg,
                  border: "none",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  color: "#fff",
                  fontSize: 20,
                  opacity,
                  transition: "opacity 0.1s linear",
                  cursor: opacity > 0 ? "pointer" : "default",
                }}
              >
                {item.emoji}
              </button>
            );
          })}
        </div>
      )}

      {/* Long Press Modal */}
      {showLongPress && (
        <LongPressMessageModal
          messageSenderName={message.senderId === myUid ? "you" : "them"}
          onClose={() => setShowLongPress(false)}
          onReaction={(emoji) => onReaction(message.id, emoji)}
          onReply={() => {
            setReplyTo(message);
            setShowLongPress(false);
          }}
          onCopy={() => navigator.clipboard.writeText(message.text || "")}
          onPin={() => onPinMessage(message.id)}
          onDelete={() => onDeleteMessage(message.id)}
        />
      )}

      {/* Media Viewer */}
      {showMediaViewer && mediaItems.length > 0 && (
        <MediaViewer
          items={mediaItems}
          startIndex={currentMediaIndex}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </div>
  );
}