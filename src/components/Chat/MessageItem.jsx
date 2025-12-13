import React, { useState, useRef, useEffect } from "react";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 300; // characters to show per "Read more"
const LONG_PRESS_DELAY = 700; // ms
const SWIPE_TRIGGER_DISTANCE = 60; // px

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  registerRef,
  onReact,
  onDelete,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  // Modal state
  const [showLongPress, setShowLongPress] = useState(false);
  const longPressTimer = useRef(null);

  // Read-more
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const isLongText = message.text && message.text.length > visibleChars;

  // Swipe
  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);

  // Local reactions (optimistic UI)
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);

  // Register DOM ref with parent
  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
  }, []);

  // ---------------- Long-press detection ----------------
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
      el.removeEventListener("mousedown", startPress);
      el.removeEventListener("mouseup", cancelPress);
      el.removeEventListener("mouseleave", cancelPress);
      el.removeEventListener("touchstart", startPress);
      el.removeEventListener("touchend", cancelPress);
    };
  }, []);

  // ---------------- Swipe handlers ----------------
  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
  };

  const handleTouchMove = (e) => {
    if (!swipeActive) return;
    const diff = e.touches[0].clientX - swipeStartX.current;
    const limited = Math.max(Math.min(diff, 120), -120);
    setSwipeX(limited);
  };

  const handleTouchEnd = () => {
    if (!swipeActive) return;
    if (Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) setReplyTo?.(message);
    setSwipeX(0);
    setSwipeActive(false);
  };

  // ---------------- Status (sent/delivered/seen) ----------------
  const renderStatus = () => {
    if (!isMine) return null;
    const total = message.totalParticipants || 2;
    const delivered = message.deliveredTo?.length || 0;
    const seen = message.seenBy?.length || 0;
    if (seen >= total - 1) return "✔✔";
    if (delivered >= total - 1) return "✔✔";
    return "✔";
  };

  // ---------------- Reply preview ----------------
  const ReplyPreview = ({ reply }) => {
    if (!reply) return null;
    return (
      <div
        onClick={() => {
          if (reply.id) {
            const el = document.getElementById(reply.id);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // ---------------- UI variables ----------------
  const bubbleBg = isMine ? "#007bff" : isDark ? "#222" : "#fff";
  const bubbleColor = isMine ? "#fff" : isDark ? "#fff" : "#000";

  return (
    <>
      <div
        id={message.id}
        ref={(el) => {
          containerRef.current = el;
          if (el) registerRef?.(el);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
        {/* Swipe indicator */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: !isMine ? -36 : undefined,
            right: isMine ? -36 : undefined,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 18,
            opacity: Math.min(1, Math.abs(swipeX) / SWIPE_TRIGGER_DISTANCE),
            color: "#4caf50",
            pointerEvents: "none",
          }}
        >
          ↪
        </div>

        {/* Reply Preview */}
        <ReplyPreview reply={message.replyTo} />

        {/* Text */}
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
              >
                Read more
              </button>
            )}
          </div>
        )}

        {/* Media */}
        {message.mediaUrl && (
          message.mediaType === "image" ? (
            <img
              src={message.mediaUrl}
              alt="media"
              onClick={() => onMediaClick?.(message)}
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
              style={{
                width: "100%",
                marginTop: message.text ? 8 : 0,
                borderRadius: 12,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )
        )}

        {/* Reactions (text under media) */}
        {localReactions && Object.keys(localReactions).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {Object.entries(localReactions).map(([emoji, users]) => {
              const reactedByMe = users.includes(myUid);
              return (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact?.(message.id, emoji);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 6px",
                    fontSize: 14,
                    borderRadius: 12,
                    border: reactedByMe ? "1px solid #4a90e2" : "1px solid #ccc",
                    backgroundColor: reactedByMe ? "#4a90e2" : isDark ? "#2a2a2a" : "#f0f0f0",
                    color: reactedByMe ? "#fff" : isDark ? "#fff" : "#000",
                    cursor: "pointer",
                  }}
                >
                  {emoji} {users.length}
                </button>
              );
            })}
          </div>
        )}

        {/* Status */}
        {isMine && (
          <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 6 }}>
            {renderStatus()}
          </div>
        )}
      </div>

      {/* Long-press modal */}
      {showLongPress && (
        <LongPressMessageModal
          isDark={isDark}
          message={message}
          myUid={myUid}
          setReplyTo={setReplyTo}
          setPinnedMessage={setPinnedMessage}
          localReactions={localReactions}
          onClose={() => setShowLongPress(false)}
          onDelete={onDelete}
        />
      )}
    </>
  );
}