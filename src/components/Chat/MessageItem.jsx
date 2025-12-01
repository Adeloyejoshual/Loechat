// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useContext, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import EmojiPicker from "./EmojiPicker";
import { toast } from "react-toastify";

const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#777",
  reactionBg: "rgba(0,0,0,0.7)",
};

const LONG_PRESS_DELAY = 420;
const SWIPE_REPLY_THRESHOLD = 70;
const DOUBLE_TAP_MS = 300;

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
  const { theme } = useContext(ThemeContext);

  const containerRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);
  const lastTap = useRef(0);
  const rafRef = useRef(null);

  const [showReactions, setShowReactions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  const fmtTime = (ts) =>
    ts?.toDate
      ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  /* ----------------- Firestore actions ----------------- */
  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    setShowBottomSheet(false);
    toast.success(newPin ? "Message pinned" : "Message unpinned");
  };

  const deleteMessage = async () => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    await updateDoc(doc(db, "chats", chatId, "messages", message.id), { deleted: true });
    setShowBottomSheet(false);
    toast.success("Message deleted");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    setShowBottomSheet(false);
    toast.success("Copied!");
  };

  const applyReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const currentEmoji = message.reactions?.[myUid];
    let updateObj = {};
    if (currentEmoji === emoji) {
      updateObj = { [`reactions.${myUid}`]: null }; // remove emoji if same
      toast.info(`Removed ${emoji} reaction`);
    } else {
      updateObj = { [`reactions.${myUid}`]: emoji };
      toast.success(`Reacted ${emoji}`);
    }
    await updateDoc(msgRef, updateObj);
    setShowReactions(false);
    setShowEmojiPicker(false);
    setShowBottomSheet(false);
  };

  /* ----------------- Reaction bar ----------------- */
  const openReactionBar = () => {
    const rect = containerRef.current.getBoundingClientRect();
    setEmojiPos({ top: rect.top + window.scrollY - 60, left: rect.left + rect.width / 2 });
    setShowReactions(true);
  };

  const startLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      openReactionBar();
    }, LONG_PRESS_DELAY);
  };
  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  /* ----------------- Double tap toggle ❤️ ----------------- */
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current <= DOUBLE_TAP_MS) {
      applyReaction("❤️"); // toggles
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  /* ----------------- Swipe to reply ----------------- */
  const handleTouchStart = (e) => {
    if (!enableSwipeReply) return;
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
    startLongPress();
  };

  const handleTouchMove = (e) => {
    if (!enableSwipeReply) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 10) cancelLongPress();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setTranslateX(Math.max(0, dx)));
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (!enableSwipeReply) return;
    if (translateX > SWIPE_REPLY_THRESHOLD) {
      setTranslateX(120);
      setTimeout(() => {
        setReplyTo(message);
        toast.info("Replying…");
        setTranslateX(0);
        setIsSwiping(false);
      }, 160);
    } else {
      setTranslateX(0);
      setIsSwiping(false);
    }
  };

  /* ----------------- Mouse handlers ----------------- */
  const handleMouseDown = () => startLongPress();
  const handleMouseUp = () => { cancelLongPress(); handleTap(); };
  const handleMouseLeave = () => cancelLongPress();

  useEffect(() => {
    return () => {
      cancelLongPress();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const openBottomSheet = () => { setShowBottomSheet(true); setShowReactions(false); };
  const closeBottomSheet = () => setShowBottomSheet(false);

  return (
    <>
      <div
        ref={containerRef}
        className={`message-item ${isMine ? "mine" : "other"} ${isDark ? "dark" : "light"}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: 12,
          position: "relative",
        }}
        onContextMenu={(e) => { e.preventDefault(); openBottomSheet(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Message bubble */}
        <div
          className="message-bubble"
          style={{
            maxWidth: "72%",
            padding: 12,
            borderRadius: 16,
            background: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
            color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
            transform: `translateX(${translateX}px)`,
            transition: isSwiping ? "none" : "transform 200ms cubic-bezier(.2,.9,.2,1)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            position: "relative",
            userSelect: "none",
          }}
        >
          {/* Reply preview */}
          {message.replyTo && (
            <div
              onClick={() => onReplyClick?.(message.replyTo?.id)}
              style={{
                fontSize: 12,
                opacity: 0.75,
                borderLeft: `2px solid ${COLORS.mutedText}`,
                paddingLeft: 8,
                marginBottom: 6,
                cursor: "pointer",
              }}
            >
              ↪ {message.replyTo?.text?.slice(0, 60)}
            </div>
          )}

          {/* Text / media */}
          {message.text && <div>{message.text}</div>}
          {message.mediaUrl && message.mediaType === "image" && (
            <img src={message.mediaUrl} alt="media" style={{ maxWidth: "100%", borderRadius: 10, marginTop: 6 }} />
          )}
          {message.mediaUrl && message.mediaType === "video" && (
            <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: 10, marginTop: 6 }} />
          )}
          {message.mediaUrl && message.mediaType === "audio" && (
            <audio src={message.mediaUrl} controls style={{ marginTop: 6 }} />
          )}

          {/* Timestamp */}
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, textAlign: "right" }}>
            {fmtTime(message.createdAt)}
          </div>

          {/* Inline reactions */}
          {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {Object.entries(message.reactions)
                .filter(([_, v]) => v)
                .map(([uid, emoji], i) => (
                  <span
                    key={i}
                    style={{
                      background: COLORS.reactionBg,
                      color: "#fff",
                      padding: "0 7px",
                      borderRadius: 14,
                      fontSize: 12,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <EmojiPicker
            position={emojiPos}
            onSelect={applyReaction}
            onClose={() => setShowEmojiPicker(false)}
            isDark={isDark}
          />
        )}
      </div>

      {/* Bottom sheet / actions */}
      {showBottomSheet && (
        <>
          <div className="sheet-backdrop" onClick={closeBottomSheet} />
          <div className="bottom-sheet" role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <div className="sheet-actions">
              <button className="sheet-action" onClick={() => { setReplyTo(message); toast.info("Replying…"); closeBottomSheet(); }}>
                ↩️ Reply
              </button>
              <button className="sheet-action" onClick={copyMessage}>📋 Copy</button>
              <button className="sheet-action" onClick={togglePin}>📌 {pinnedMessage?.id === message.id ? "Unpin" : "Pin"}</button>
              <button className="sheet-action danger" onClick={deleteMessage}>🗑️ Delete</button>
              <button className="sheet-action" onClick={closeBottomSheet}>Close</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}