// src/components/Chat/MessageItem.jsx
import React, { useState, useRef } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#888",
  reactionBg: "#111",
};

const SPACING = { sm: 8, lg: 14, borderRadius: 12 };
const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "💖"];

export default function MessageItem({
  message,
  myUid,
  isDark,
  chatId,
  setReplyTo,
  pinnedMessage,
  setPinnedMessage,
  onReplyClick,
  enableSwipeReply = true,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });

  // Swipe to reply
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

  const fmtTime = (ts) =>
    ts?.toDate
      ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    setMenuOpen(false);
  };

  const deleteMessage = async () => {
    if (!confirm("Delete this message?")) return;
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
    setMenuOpen(false);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    alert("Copied!");
    setMenuOpen(false);
  };

  const openReactions = () => {
    const rect = containerRef.current.getBoundingClientRect();
    setEmojiPos({ top: rect.top + window.scrollY - 50, left: rect.left + rect.width / 2 });
    setShowReactions(true);
  };

  const applyReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    await updateDoc(msgRef, { [`reactions.${myUid}`]: emoji });
    setShowReactions(false);
  };

  const handleTouchStart = (e) => {
    if (!enableSwipeReply) return;
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const handleTouchMove = (e) => {
    if (!enableSwipeReply) return;
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (!enableSwipeReply) return;
    if (touchDelta.current > 80) setReplyTo(message);
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        marginBottom: SPACING.sm,
        position: "relative",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onLongPress={openReactions} // Custom or library for long press
    >
      {/* Message bubble */}
      <div
        style={{
          maxWidth: "70%",
          padding: SPACING.sm,
          borderRadius: SPACING.borderRadius,
          backgroundColor: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
          color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
          cursor: "pointer",
          wordBreak: "break-word",
          position: "relative",
        }}
      >
        {message.replyTo && (
          <div
            onClick={() => onReplyClick?.(message.replyTo.id)}
            style={{
              fontSize: 12,
              fontStyle: "italic",
              borderLeft: `2px solid ${COLORS.mutedText}`,
              paddingLeft: 4,
              marginBottom: 4,
              cursor: "pointer",
              opacity: 0.7,
            }}
          >
            ↪ {message.replyTo.text.slice(0, 50)}
          </div>
        )}

        {message.text && <div>{message.text}</div>}

        {message.mediaUrl && message.mediaType === "image" && (
          <img src={message.mediaUrl} style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
        )}
        {message.mediaUrl && message.mediaType === "video" && (
          <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: SPACING.borderRadius }} />
        )}
        {message.mediaUrl && message.mediaType === "audio" && <audio src={message.mediaUrl} controls />}
        {message.mediaUrl && message.mediaType === "file" && (
          <a href={message.mediaUrl} target="_blank" rel="noreferrer">
            {message.fileName || "File"}
          </a>
        )}

        {/* Timestamp */}
        <div style={{ fontSize: 10, color: COLORS.mutedText, marginTop: 2, textAlign: "right" }}>
          {fmtTime(message.createdAt)}
        </div>

        {/* Reactions */}
        {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
          <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
            {Object.values(message.reactions)
              .filter(Boolean)
              .map((r, i) => (
                <span
                  key={i}
                  style={{
                    backgroundColor: COLORS.reactionBg,
                    color: "#fff",
                    borderRadius: 8,
                    padding: "0 4px",
                    fontSize: 10,
                  }}
                >
                  {r}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: -SPACING.lg,
            right: 0,
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            border: `1px solid ${COLORS.mutedText}`,
            borderRadius: SPACING.borderRadius,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <button style={{ padding: 6, cursor: "pointer" }} onClick={() => setReplyTo(message)}>
            Reply
          </button>
          <button style={{ padding: 6, cursor: "pointer" }} onClick={copyMessage}>
            Copy
          </button>
          <button style={{ padding: 6, cursor: "pointer" }} onClick={togglePin}>
            {pinnedMessage?.id === message.id ? "Unpin" : "Pin"}
          </button>
          {isMine && (
            <button style={{ padding: 6, cursor: "pointer", color: "red" }} onClick={deleteMessage}>
              Delete
            </button>
          )}
          <button style={{ padding: 6, cursor: "pointer" }} onClick={() => setMenuOpen(false)}>
            Close
          </button>
        </div>
      )}

      {/* Reactions bar (long press) */}
      {showReactions && (
        <div
          style={{
            position: "absolute",
            top: emojiPos.top,
            left: emojiPos.left,
            transform: "translate(-50%, -100%)",
            background: isDark ? COLORS.darkCard : COLORS.lightCard,
            borderRadius: 30,
            padding: 6,
            display: "flex",
            gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            zIndex: 999,
          }}
        >
          {QUICK_REACTIONS.map((e) => (
            <span key={e} style={{ fontSize: 20, cursor: "pointer" }} onClick={() => applyReaction(e)}>
              {e}
            </span>
          ))}
          <span
            style={{ fontSize: 20, cursor: "pointer" }}
            onClick={() => setShowReactions(false)}
          >
            ➕
          </span>
        </div>
      )}
    </div>
  );
}