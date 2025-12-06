// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 500;
const SWIPE_TRIGGER_DISTANCE = -70;

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  friendInfo,
  onMediaClick,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  // -------------------- Long press --------------------
  const [showLongPress, setShowLongPress] = useState(false);
  const longPressTimer = useRef(null);

  // -------------------- Read more --------------------
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const isLongText = message.text?.length > visibleChars;

  // -------------------- Swipe --------------------
  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipeTimer = useRef(null);

  // -------------------- Events --------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startPress = () => {
      longPressTimer.current = setTimeout(() => setShowLongPress(true), LONG_PRESS_DELAY);
    };
    const cancelPress = () => clearTimeout(longPressTimer.current);

    el.addEventListener("mousedown", startPress);
    el.addEventListener("mouseup", cancelPress);
    el.addEventListener("mouseleave", cancelPress);
    el.addEventListener("touchstart", startPress);
    el.addEventListener("touchend", cancelPress);

    return () => {
      cancelPress();
      el.removeEventListener("mousedown", startPress);
      el.removeEventListener("mouseup", cancelPress);
      el.removeEventListener("mouseleave", cancelPress);
      el.removeEventListener("touchstart", startPress);
      el.removeEventListener("touchend", cancelPress);
    };
  }, []);

  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeTimer.current = setTimeout(() => {}, 500);
  };

  const handleTouchMove = (e) => {
    const diff = e.touches[0].clientX - swipeStartX.current;
    if (diff < 0) setSwipeX(diff);
  };

  const handleTouchEnd = () => {
    clearTimeout(swipeTimer.current);
    if (swipeX < SWIPE_TRIGGER_DISTANCE) setReplyTo(message);
    setSwipeX(0);
  };

  const scrollToOriginal = () => {
    if (!message.replyTo?.id) return;
    const el = document.getElementById(message.replyTo.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // -------------------- Delivered / Seen --------------------
  const renderStatus = () => {
    if (!isMine) return null;

    const totalParticipants = message.totalParticipants || 2; // default 2
    const deliveredCount = message.deliveredTo?.length || 0;
    const seenCount = message.seenBy?.length || 0;

    if (seenCount >= totalParticipants - 1) {
      return "✔✔"; // seen (blue)
    } else if (deliveredCount >= totalParticipants - 1) {
      return "✔✔"; // delivered (gray)
    } else {
      return "✔"; // sent
    }
  };

  // -------------------- Styles --------------------
  const bubbleStyle = {
    alignSelf: isMine ? "flex-end" : "flex-start",
    maxWidth: "75%",
    margin: "6px 0",
    padding: 10,
    borderRadius: 14,
    backgroundColor: isMine ? (isDark ? "#1976d2" : "#d0e7ff") : isDark ? "#2a2a2a" : "#fff",
    color: isMine ? "#fff" : isDark ? "#fff" : "#000",
    transform: `translateX(${swipeX}px)`,
    transition: swipeX ? "none" : "transform 0.2s ease",
    wordBreak: "break-word",
    position: "relative",
  };

  return (
    <>
      <div
        id={message.id}
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={bubbleStyle}
      >
        {/* Reply Preview */}
        {message.replyTo && (
          <div
            onClick={scrollToOriginal}
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              opacity: 0.8,
              borderLeft: "3px solid #4caf50",
              paddingLeft: 6,
              marginBottom: 6,
            }}
          >
            {message.replyTo.mediaUrl ? (
              <img
                src={message.replyTo.mediaUrl}
                alt="reply"
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }}
              />
            ) : (
              <span>{message.replyTo.text?.slice(0, 60) || "Message"}</span>
            )}
          </div>
        )}

        {/* Text */}
        {message.text && (
          <div>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <span
                onClick={() => setVisibleChars((p) => p + READ_MORE_STEP)}
                style={{ marginLeft: 6, fontWeight: 500, cursor: "pointer", opacity: 0.9 }}
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
              onClick={() => onMediaClick?.(message)}
              alt="media"
              style={{ width: "100%", marginTop: 8, borderRadius: 10, cursor: "pointer" }}
            />
          ) : (
            <video src={message.mediaUrl} controls style={{ width: "100%", marginTop: 8, borderRadius: 10 }} />
          ))}

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {Object.entries(message.reactions).map(([emoji, users]) => (
              <span key={emoji} style={{ fontSize: 14 }}>
                {emoji} {users.length > 1 ? users.length : ""}
              </span>
            ))}
          </div>
        )}

        {/* Status */}
        {isMine && (
          <div style={{ fontSize: 10, opacity: 0.7, textAlign: "right", marginTop: 4 }}>
            {renderStatus()}
          </div>
        )}
      </div>

      {/* Long Press Modal */}
      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setShowLongPress(false)}
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
          onDelete={() => setShowLongPress(false)}
          messageSenderName={isMine ? "You" : friendInfo?.name || "User"}
        />
      )}
    </>
  );
}