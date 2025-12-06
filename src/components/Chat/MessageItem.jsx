// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  pinnedMessage,
  setPinnedMessage,
  friendInfo,
  onMediaClick,
  mediaItems = [],
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  // Long press modal
  const [showLongPress, setShowLongPress] = useState(false);

  // Read more for long messages
  const [showFullText, setShowFullText] = useState(false);
  const MAX_PREVIEW_LENGTH = 120;

  // Swipe to reply
  const [swipeStartX, setSwipeStartX] = useState(0);
  const [swipeDeltaX, setSwipeDeltaX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  // -------------------- Long press detection --------------------
  useEffect(() => {
    let timer = null;
    const el = containerRef.current;
    if (!el) return;

    const startPress = () => (timer = setTimeout(() => setShowLongPress(true), 500));
    const endPress = () => clearTimeout(timer);

    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", endPress);
    el.addEventListener("touchstart", startPress);
    el.addEventListener("touchend", endPress);

    return () => {
      el.removeEventListener("mousedown", startPress);
      el.removeEventListener("mouseup", endPress);
      el.removeEventListener("touchstart", startPress);
      el.removeEventListener("touchend", endPress);
    };
  }, []);

  // -------------------- Swipe to reply detection --------------------
  const handleTouchStart = (e) => {
    setSwipeStartX(e.touches[0].clientX);
    setSwiping(true);
  };
  const handleTouchMove = (e) => {
    if (!swiping) return;
    setSwipeDeltaX(e.touches[0].clientX - swipeStartX);
  };
  const handleTouchEnd = () => {
    if (swiping && swipeDeltaX > 60) setReplyTo(message); // swipe right
    setSwiping(false);
    setSwipeDeltaX(0);
  };

  // -------------------- Text display --------------------
  const displayText =
    message.text && !showFullText && message.text.length > MAX_PREVIEW_LENGTH
      ? message.text.slice(0, MAX_PREVIEW_LENGTH) + "..."
      : message.text;

  // -------------------- Media click --------------------
  const handleMediaClick = () => {
    if (!message.mediaUrl) return;
    const index = mediaItems.findIndex((m) => m.url === message.mediaUrl);
    onMediaClick(index);
  };

  return (
    <>
      <div
        id={message.id}
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleMediaClick}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "75%",
          margin: "4px 0",
          padding: 8,
          borderRadius: 12,
          backgroundColor: isMine
            ? isDark
              ? "#1976d2"
              : "#d0e7ff"
            : isDark
            ? "#2a2a2a"
            : "#fff",
          color: isMine ? "#fff" : isDark ? "#fff" : "#000",
          position: "relative",
          transform: swiping ? `translateX(${swipeDeltaX}px)` : "none",
          transition: swiping ? "none" : "transform 0.2s ease",
          cursor: "pointer",
        }}
      >
        {/* Reply preview */}
        {message.replyTo && (
          <div
            style={{
              fontSize: 12,
              color: isDark ? "#aaa" : "#555",
              marginBottom: 4,
              paddingLeft: 4,
              borderLeft: `2px solid ${isMine ? "#fff" : "#1976d2"}`,
            }}
          >
            {message.replyTo.text || "Media"}
          </div>
        )}

        {/* Text */}
        {displayText && (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {displayText}
            {message.text && !showFullText && message.text.length > MAX_PREVIEW_LENGTH && (
              <span
                style={{
                  color: isMine ? "#fff" : "#1976d2",
                  cursor: "pointer",
                  marginLeft: 4,
                  fontWeight: 500,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullText(true);
                }}
              >
                Read more
              </span>
            )}
          </div>
        )}

        {/* Media */}
        {message.mediaUrl &&
          (message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt="media"
              style={{ width: "100%", marginTop: 4, borderRadius: 8 }}
              draggable={false}
            />
          ) : (
            <video
              src={message.mediaUrl}
              controls
              style={{ width: "100%", marginTop: 4, borderRadius: 8 }}
            />
          ))}

        {/* Status */}
        {isMine && message.status && (
          <div
            style={{
              fontSize: 10,
              color: "#888",
              position: "absolute",
              bottom: 2,
              right: 6,
            }}
          >
            {message.status}
          </div>
        )}
      </div>

      {/* Long press modal */}
      {showLongPress && (
        <LongPressMessageModal
          onClose={() => setShowLongPress(false)}
          onReaction={() => {}}
          onReply={() => {
            setReplyTo(message);
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
          onDelete={() => setShowLongPress(false)} // Implement delete logic in parent
          isDark={isDark}
          messageSenderName={isMine ? "you" : friendInfo?.name || "friend"}
        />
      )}
    </>
  );
}