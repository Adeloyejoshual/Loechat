// src/components/Chat/MessageItem.jsx
import React, { useRef, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import LongPressMessageModal from "./LongPressMessageModal";
import EmojiPicker from "./EmojiPicker";
import { toast } from "react-toastify";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

const formatTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  registerRef,
  onReact,
  onDeleteForMe,
  onDeleteForEveryone,
  onOpenLongPress,
  onOpenEmojiPicker,
  isLongPressOpen,
  isEmojiPickerOpen,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);
  const longPressTimer = useRef(null);

  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const isLongText = Boolean(message.text && message.text.length > visibleChars);

  const swipeStartX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);

  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "❤️" });

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);
  useEffect(() => {
    if (containerRef.current) registerRef?.(containerRef.current);
  }, []);

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => onOpenLongPress(message), LONG_PRESS_DELAY);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const handleReact = (emoji) => {
    onReact?.(message.id, emoji);
    setReactionAnim({ show: true, emoji });
    setTimeout(() => setReactionAnim({ show: false, emoji }), 800);
  };

  const mediaArray = message.mediaUrls || (message.mediaUrl ? [message.mediaUrl] : []);
  const renderMediaGrid = () => {
    if (!mediaArray.length) return null;

    const maxVisible = 4;
    const extraCount = mediaArray.length - maxVisible;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            mediaArray.length === 1
              ? "1fr"
              : mediaArray.length === 2
              ? "1fr 1fr"
              : "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 4,
          marginBottom: 6,
          position: "relative",
        }}
      >
        {mediaArray.slice(0, maxVisible).map((url, idx) => (
          <div key={idx} style={{ position: "relative" }}>
            <img
              src={url}
              alt=""
              style={{
                width: "100%",
                aspectRatio: "1/1",
                objectFit: "cover",
                borderRadius: 12,
                cursor: "pointer",
                opacity: message.status === "sending" ? 0.6 : 1,
              }}
              onClick={() => onMediaClick?.(message, idx)}
            />
            {message.status === "sending" && message.uploadProgress != null && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  borderRadius: 12,
                  fontSize: 16,
                  color: "#fff",
                  fontWeight: "bold",
                }}
              >
                {message.uploadProgress}%
              </div>
            )}
          </div>
        ))}
        {extraCount > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: "bold",
              borderRadius: 12,
            }}
          >
            +{extraCount}
          </div>
        )}
      </div>
    );
  };

  if (message.deleted || (message.deletedForMe && isMine)) return null;

  return (
    <>
      <div
        ref={containerRef}
        onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; setSwipeActive(true); startLongPress(); }}
        onTouchMove={(e) => {
          const diff = e.touches[0].clientX - swipeStartX.current;
          if (Math.abs(diff) > 10) cancelLongPress();
          if (!swipeActive) return;
          setSwipeX(Math.max(Math.min(diff, 120), -120));
        }}
        onTouchEnd={() => { cancelLongPress(); setSwipeX(0); setSwipeActive(false); }}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        style={{
          alignSelf: isMine ? "flex-end" : "flex-start",
          maxWidth: "78%",
          margin: "6px 0",
          padding: 12,
          borderRadius: 16,
          backgroundColor: isMine ? "#007bff" : isDark ? "#222" : "#fff",
          color: isMine ? "#fff" : isDark ? "#fff" : "#000",
          transform: `translateX(${swipeX}px)`,
          transition: swipeX ? "none" : "transform 0.18s ease",
          wordBreak: "break-word",
          position: "relative",
          userSelect: "none",
        }}
      >
        {renderMediaGrid()}

        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, marginTop: mediaArray.length ? 4 : 0 }}>
            {message.text.slice(0, visibleChars)}
            {isLongText && (
              <span
                onClick={() => setVisibleChars((v) => v + READ_MORE_STEP)}
                style={{ color: "#888", cursor: "pointer" }}
              >
                ...more
              </span>
            )}
          </div>
        )}

        {Object.entries(localReactions || {}).length > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
            {Object.entries(localReactions).map(([emoji, users]) => (
              <div key={emoji}>{emoji} {users.length}</div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 6 }}>
          {formatTime(message.createdAt)}
        </div>

        {reactionAnim.show && (
          <div
            style={{
              position: "absolute",
              top: -20,
              right: 10,
              fontSize: 20,
              animation: "floatUp 0.8s ease-out forwards",
            }}
          >
            {reactionAnim.emoji}
          </div>
        )}

        {/* Emoji button */}
        <button
          onClick={onOpenEmojiPicker}
          style={{
            position: "absolute",
            top: -28,
            right: -4,
            background: "transparent",
            border: "none",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          😀
        </button>
      </div>

      {/* Long Press Modal */}
      {isLongPressOpen && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => onOpenLongPress(null)}
          onReply={() => { setReplyTo(message); onOpenLongPress(null); }}
          onPin={() => { setPinnedMessage(message); onOpenLongPress(null); toast.success("Pinned!"); }}
          onCopy={() => { navigator.clipboard.writeText(message.text || ""); toast.success("Copied!"); onOpenLongPress(null); }}
          onReaction={handleReact}
          onDeleteForMe={() => onDeleteForMe?.(message)}
          onDeleteForEveryone={() => onDeleteForEveryone?.(message)}
          message={message}
          onMediaClick={onMediaClick}
        />
      )}

      {/* Emoji Picker */}
      {isEmojiPickerOpen && (
        <EmojiPicker
          onSelect={(emoji) => { handleReact(emoji); onOpenEmojiPicker(null); }}
          onClose={() => onOpenEmojiPicker(null)}
        />
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
      `}</style>
    </>
  );
}