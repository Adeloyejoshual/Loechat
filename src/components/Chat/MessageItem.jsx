// src/components/Chat/MessageItem.jsx
import React, { useState, useRef, useContext, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ThemeContext } from "../../context/ThemeContext";
import EmojiPicker from "./EmojiPicker";
import { toast } from "react-toastify";

/* ----------------- Config ----------------- */
const COLORS = {
  primary: "#34B7F1",
  lightCard: "#fff",
  darkCard: "#1b1b1b",
  darkText: "#fff",
  mutedText: "#777",
  reactionBg: "rgba(0,0,0,0.7)",
};

const QUICK_REACTIONS = ["😜", "💗", "😎", "😍", "☻️", "💖"];
const LONG_PRESS_DELAY = 420; // ms
const SWIPE_REPLY_THRESHOLD = 70; // px
const DOUBLE_TAP_MS = 300;

/* -------------- Component -------------- */
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

  // refs + timers
  const containerRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);
  const lastTap = useRef(0);
  const rafRef = useRef(null);

  // UI state
  const [menuOpen, setMenuOpen] = useState(false); // bottom-sheet
  const [showReactions, setShowReactions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [translateX, setTranslateX] = useState(0); // for swipe animation
  const [isSwiping, setIsSwiping] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  /* ----------------- Helpers ----------------- */
  const fmtTime = (ts) =>
    ts?.toDate
      ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  /* ----------------- Firestore actions (kept same) ----------------- */
  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    setShowBottomSheet(false);
    toast.success(newPin ? "Message pinned" : "Message unpinned");
  };

  const deleteMessage = async () => {
    if (!window.confirm("Delete this message?")) return;
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
    await updateDoc(msgRef, { [`reactions.${myUid}`]: emoji });
    setShowReactions(false);
    setShowEmojiPicker(false);
    setShowBottomSheet(false);
    toast.success(`Reacted ${emoji}`);
  };

  /* ----------------- Reaction bar position ----------------- */
  const openReactionBar = () => {
    const rect = containerRef.current.getBoundingClientRect();
    setEmojiPos({ top: rect.top + window.scrollY - 60, left: rect.left + rect.width / 2 });
    setShowReactions(true);
  };

  /* ----------------- Long press ----------------- */
  const startLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      openReactionBar();
    }, LONG_PRESS_DELAY);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  /* ----------------- Double tap to ❤️ ----------------- */
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current <= DOUBLE_TAP_MS) {
      // double tap
      applyReaction("❤️");
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  /* ----------------- Swipe to reply (with smooth animation) ----------------- */
  const handleTouchStart = (e) => {
    if (!enableSwipeReply) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    setIsSwiping(true);
    startLongPress(); // keep long press available
  };

  const handleTouchMove = (e) => {
    if (!enableSwipeReply) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    // Only allow right swipe interaction
    const clamped = Math.max(0, dx);
    // small cancel long press if user is moving finger
    if (Math.abs(dx) > 10) cancelLongPress();

    // smooth update using requestAnimationFrame
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setTranslateX(clamped > 120 ? 120 + (clamped - 120) * 0.2 : clamped); // elastic after 120px
    });
  };

  const resetSwipe = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTranslateX(0);
    setIsSwiping(false);
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (!enableSwipeReply) return;

    if (translateX > SWIPE_REPLY_THRESHOLD) {
      // trigger reply with slide animation
      setTranslateX(160); // slide off a bit
      setTimeout(() => {
        setReplyTo(message);
        toast.info("Replying to message");
        // return bubble to neutral after brief animation
        setTranslateX(0);
        setIsSwiping(false);
      }, 160);
    } else {
      resetSwipe();
    }
  };

  /* ----------------- Mouse handlers (desktop) ----------------- */
  const handleMouseDown = (e) => {
    // left-click or touch-like activation
    if (e.button === 0) {
      startLongPress();
    }
  };

  const handleMouseUp = (e) => {
    cancelLongPress();
    // treat click as potential tap
    handleTap();
  };

  const handleMouseLeave = () => {
    cancelLongPress();
  };

  /* ----------------- Cleanup ----------------- */
  useEffect(() => {
    return () => {
      cancelLongPress();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* ----------------- Bottom sheet (action menu) ----------------- */
  const openBottomSheet = () => {
    setShowBottomSheet(true);
    setMenuOpen(false);
  };

  const closeBottomSheet = () => {
    setShowBottomSheet(false);
  };

  /* ----------------- Render ----------------- */
  return (
    <>
      <div
        ref={containerRef}
        className={`message-item ${isMine ? "mine" : "other"} ${isDark ? "dark" : "light"}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isMine ? "flex-end" : "flex-start",
          marginBottom: 10,
          position: "relative",
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          // open bottom sheet for mobile-friendly actions
          openBottomSheet();
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Message bubble (animated with translateX on swipe) */}
        <div
          className="message-bubble"
          style={{
            maxWidth: "72%",
            padding: 12,
            borderRadius: 14,
            background: isMine ? COLORS.primary : isDark ? COLORS.darkCard : COLORS.lightCard,
            color: isMine ? "#fff" : isDark ? COLORS.darkText : "#000",
            transform: `translateX(${translateX}px)`,
            transition: isSwiping ? "transform 0ms linear" : "transform 180ms cubic-bezier(.2,.9,.2,1)",
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            position: "relative",
            userSelect: "none",
          }}
          onClick={() => {
            // single click -> tap (used for double-tap detection)
            handleTap();
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
            <img
              src={message.mediaUrl}
              alt="media"
              style={{ maxWidth: "100%", marginTop: 8, borderRadius: 10 }}
            />
          )}
          {message.mediaUrl && message.mediaType === "video" && (
            <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />
          )}
          {message.mediaUrl && message.mediaType === "audio" && (
            <audio src={message.mediaUrl} controls style={{ marginTop: 8 }} />
          )}

          {/* timestamp */}
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, textAlign: "right" }}>
            {fmtTime(message.createdAt)}
          </div>

          {/* inline reactions */}
          {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {Object.entries(message.reactions)
                .filter(([_, v]) => v)
                .map(([uid, emoji], i) => (
                  <span
                    key={i}
                    className="reaction-chip"
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

        {/* Quick reactions popup (long-press opens it) */}
        {showReactions && (
          <div
            className="quick-reactions"
            style={{
              position: "absolute",
              top: emojiPos.top,
              left: emojiPos.left,
              transform: "translate(-50%, -100%)",
              background: isDark ? COLORS.darkCard : COLORS.lightCard,
              borderRadius: 30,
              padding: 8,
              display: "flex",
              gap: 8,
              boxShadow: "0 6px 22px rgba(0,0,0,0.18)",
              zIndex: 1200,
              animation: "popIn 140ms ease",
            }}
            onMouseLeave={() => setShowReactions(false)}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                className="emoji-btn pulse"
                onClick={() => applyReaction(e)}
                aria-label={`React ${e}`}
                style={{
                  fontSize: 20,
                  lineHeight: "20px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {e}
              </button>
            ))}

            <button
              className="emoji-btn"
              style={{ fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}
              onClick={() => {
                setShowReactions(false);
                setShowEmojiPicker(true);
              }}
            >
              ➕
            </button>
          </div>
        )}

        {/* Emoji picker */}
        {showEmojiPicker && (
          <EmojiPicker
            position={emojiPos}
            onSelect={(emoji) => applyReaction(emoji)}
            onClose={() => setShowEmojiPicker(false)}
            isDark={isDark}
          />
        )}
      </div>

      {/* Bottom sheet / action menu */}
      {showBottomSheet && (
        <>
          <div className="sheet-backdrop" onClick={closeBottomSheet} />
          <div className="bottom-sheet" role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <div className="sheet-actions">
              <button className="sheet-action" onClick={() => { setReplyTo(message); toast.info("Replying…"); closeBottomSheet(); }}>
                ↩️ Reply
              </button>
              <button className="sheet-action" onClick={() => { copyMessage(); }}>
                📋 Copy
              </button>
              <button className="sheet-action" onClick={() => { togglePin(); }}>
                📌 {pinnedMessage?.id === message.id ? "Unpin" : "Pin"}
              </button>
              {isMine && (
                <button className="sheet-action danger" onClick={() => { deleteMessage(); }}>
                  🗑️ Delete
                </button>
              )}
              <button className="sheet-action" onClick={closeBottomSheet}>
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}