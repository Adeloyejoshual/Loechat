// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450; // ~6–7 lines like WhatsApp
const LONG_PRESS_DELAY = 500;
const SWIPE_TRIGGER_DISTANCE = -70; // LEFT only

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

  // -------------------- Swipe to reply (LEFT only) --------------------
  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const swipeTimer = useRef(null);

  // -------------------- Events --------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startPress = () => {
      longPressTimer.current = setTimeout(
        () => setShowLongPress(true),
        LONG_PRESS_DELAY
      );
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

  // -------------------- Swipe LEFT only --------------------
  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;

    swipeTimer.current = setTimeout(() => {
      // enables swipe after 500ms
    }, 500);
  };

  const handleTouchMove = (e) => {
    const diff = e.touches[0].clientX - swipeStartX.current;

    if (diff < 0) {
      // LEFT only
      setSwipeX(diff);
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(swipeTimer.current);

    if (swipeX < SWIPE_TRIGGER_DISTANCE) {
      setReplyTo(message);
    }

    setSwipeX(0);
  };

  // -------------------- Scroll to original message --------------------
  const scrollToOriginal = () => {
    if (!message.replyTo?.id) return;
    const el = document.getElementById(message.replyTo.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // -------------------- Styles --------------------
  const bubbleStyle = {
    alignSelf: isMine ? "flex-end" : "flex-start",
    maxWidth: "75%",
    margin: "6px 0",
    padding: 10,
    borderRadius: 14,
    backgroundColor: isMine
      ? isDark
        ? "#1976d2"
        : "#d0e7ff"
      : isDark
      ? "#2a2a2a"
      : "#fff",
    color: isMine ? "#fff" : isDark ? "#fff" : "#000",
    transform: `translateX(${swipeX}px)`,
    transition: swipeX ? "none" : "transform 0.2s ease",
    wordBreak: "break-word",
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
        {/* ------------------ Reply Preview ------------------ */}
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
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  objectFit: "cover",
                }}
              />
            ) : (
              <span>{message.replyTo.text?.slice(0, 60) || "Message"}</span>
            )}
          </div>
        )}

        {/* ------------------ Text ------------------ */}
        {message.text && (
          <div>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <span
                onClick={() => setVisibleChars((p) => p + READ_MORE_STEP)}
                style={{
                  marginLeft: 6,
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: 0.9,
                }}
              >
                Read more
              </span>
            )}
          </div>
        )}

        {/* ------------------ Media ------------------ */}
        {message.mediaUrl &&
          (message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              onClick={() => onMediaClick?.(message)}
              alt="media"
              style={{
                width: "100%",
                marginTop: 8,
                borderRadius: 10,
                cursor: "pointer",
              }}
            />
          ) : (
            <video
              src={message.mediaUrl}
              controls
              style={{ width: "100%", marginTop: 8, borderRadius: 10 }}
            />
          ))}

        {/* ------------------ Status ------------------ */}
        {isMine && (
          <div
            style={{
              fontSize: 10,
              opacity: 0.7,
              textAlign: "right",
              marginTop: 4,
            }}
          >
            {message.status}
          </div>
        )}
      </div>

      {/* ------------------ Long Press Modal ------------------ */}
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