// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 400; // faster long press
const SWIPE_TRIGGER_DISTANCE = 60; // swipe distance to trigger reply

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  friendInfo,
  onMediaClick,
  onReact, // callback for adding reactions
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
  const [swipeTriggered, setSwipeTriggered] = useState(false);

  // -------------------- Long press --------------------
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

  // -------------------- Swipe handlers --------------------
  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeTriggered(false);
  };

  const handleTouchMove = (e) => {
    const diff = e.touches[0].clientX - swipeStartX.current;

    // Swipe right for reply
    if (!isMine && diff > 0) {
      setSwipeX(Math.min(diff, 120));
      if (diff > SWIPE_TRIGGER_DISTANCE) setSwipeTriggered(true);
    }

    // Swipe left for sender
    if (isMine && diff < 0) {
      setSwipeX(Math.max(diff, -120));
      if (Math.abs(diff) > SWIPE_TRIGGER_DISTANCE) setSwipeTriggered(true);
    }
  };

  const handleTouchEnd = () => {
    if (swipeTriggered) setReplyTo(message);
    setSwipeX(0);
    setSwipeTriggered(false);
  };

  // -------------------- Scroll to original --------------------
  const scrollToOriginal = () => {
    if (!message.replyTo?.id) return;
    const el = document.getElementById(message.replyTo.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // -------------------- Delivered / Seen --------------------
  const renderStatus = () => {
    if (!isMine) return null;
    const totalParticipants = message.totalParticipants || 2;
    const deliveredCount = message.deliveredTo?.length || 0;
    const seenCount = message.seenBy?.length || 0;
    if (seenCount >= totalParticipants - 1) return "✔✔"; // seen
    if (deliveredCount >= totalParticipants - 1) return "✔✔"; // delivered
    return "✔"; // sent
  };

  // -------------------- Bubble styles --------------------
  const bubbleStyle = {
    alignSelf: isMine ? "flex-end" : "flex-start",
    maxWidth: "75%",
    margin: "6px 0",
    padding: 10,
    borderRadius: 14,
    backgroundColor: isMine ? "#007bff" : isDark ? "#2a2a2a" : "#fff",
    color: isMine ? "#fff" : isDark ? "#fff" : "#000",
    transform: `translateX(${swipeX}px)`,
    transition: swipeX ? "none" : "transform 0.2s ease",
    wordBreak: "break-word",
    position: "relative",
  };

  const replyArrowStyle = {
    position: "absolute",
    left: isMine ? "auto" : -30,
    right: isMine ? -30 : "auto",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 18,
    opacity: swipeTriggered ? 1 : 0.4,
    color: "#4caf50",
    transition: "opacity 0.2s",
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
        {/* Swipe reply indicator */}
        <span style={replyArrowStyle}>↪</span>

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
              borderLeft: `3px solid ${isMine ? "#0056b3" : "#4caf50"}`,
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
        <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {message.reactions &&
            Object.entries(message.reactions).map(([emoji, users]) => (
              <span
                key={emoji}
                onClick={() => onReact?.(emoji)}
                style={{
                  fontSize: 14,
                  padding: "2px 6px",
                  borderRadius: 12,
                  background: isMine ? "rgba(255,255,255,0.2)" : "#eee",
                  color: isMine ? "#fff" : "#000",
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  cursor: "pointer",
                }}
              >
                {emoji} {users.length > 1 ? users.length : ""}
              </span>
            ))}
        </div>

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