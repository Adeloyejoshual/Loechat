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

const QUICK_REACTIONS = ["😜", "💗", "😎", "😍", "☻️", "💖"];
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const fmtTime = (ts) =>
    ts?.toDate
      ? ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

  const togglePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const newPin = pinnedMessage?.id !== message.id;
    await updateDoc(chatRef, { pinnedMessageId: newPin ? message.id : null });
    setPinnedMessage(newPin ? message : null);
    setShowBottomSheet(false);
    toast.success(newPin ? "Message pinned" : "Message unpinned");
  };

  const deleteMessageForEveryone = async () => {
    if (!window.confirm("Delete this message for everyone?")) return;
    setIsFading(true);
    setTimeout(async () => {
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
        deletedForAll: true,
      });
      toast.success("Message deleted for everyone");
    }, 300);
  };

  const deleteMessageForMe = async () => {
    if (!window.confirm("Delete this message?")) return;
    setIsFading(true);
    setTimeout(async () => {
      await updateDoc(doc(db, "chats", chatId, "messages", message.id), {
        deletedForMe: true,
      });
      toast.success("Message deleted");
    }, 300);
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message.text || message.mediaUrl || "");
    setShowBottomSheet(false);
    toast.success("Copied!");
  };

  const applyReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    // Toggle emoji on double-tap: remove if already exists
    const current = message.reactions?.[myUid];
    const newEmoji = current === emoji ? "" : emoji;
    await updateDoc(msgRef, { [`reactions.${myUid}`]: newEmoji });
    setShowReactions(false);
    setShowEmojiPicker(false);
    setShowBottomSheet(false);
    toast.info(newEmoji ? `Reacted ${emoji}` : "Reaction removed");
  };

  const openReactionBar = () => {
    const rect = containerRef.current.getBoundingClientRect();
    setEmojiPos({ top: rect.top + window.scrollY - 60, left: rect.left + rect.width / 2 });
    setShowReactions(true);
  };

  const startLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => openReactionBar(), LONG_PRESS_DELAY);
  };

  const cancelLongPress = () => clearTimeout(longPressTimer.current);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current <= DOUBLE_TAP_MS) {
      applyReaction("❤️");
      lastTap.current = 0;
    } else lastTap.current = now;
  };

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

  const resetSwipe = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTranslateX(0);
    setIsSwiping(false);
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    if (!enableSwipeReply) return;
    if (translateX > SWIPE_REPLY_THRESHOLD) {
      setTranslateX(160);
      setTimeout(() => {
        setReplyTo(message);
        toast.info("Replying…");
        setTranslateX(0);
        setIsSwiping(false);
      }, 160);
    } else resetSwipe();
  };

  const handleMouseDown = (e) => e.button === 0 && startLongPress();
  const handleMouseUp = () => { cancelLongPress(); handleTap(); };
  const handleMouseLeave = cancelLongPress;

  useEffect(() => () => { cancelLongPress(); if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const openBottomSheet = () => { setShowBottomSheet(true); setMenuOpen(false); };
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
          marginBottom: 10,
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
        <div
          className={`message-bubble ${isFading ? "fade-out" : ""}`}
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
        >
          {message.replyTo && (
            <div onClick={() => onReplyClick?.(message.replyTo?.id)}
              style={{ fontSize: 12, opacity: 0.75, borderLeft: `2px solid ${COLORS.mutedText}`, paddingLeft: 8, marginBottom: 6, cursor: "pointer" }}
            >
              ↪ {message.replyTo?.text?.slice(0, 60)}
            </div>
          )}

          {message.text && <div>{message.text}</div>}
          {message.mediaUrl && message.mediaType === "image" && <img src={message.mediaUrl} alt="media" style={{ maxWidth: "100%", marginTop: 8, borderRadius: 10 }} />}
          {message.mediaUrl && message.mediaType === "video" && <video src={message.mediaUrl} controls style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }} />}
          {message.mediaUrl && message.mediaType === "audio" && <audio src={message.mediaUrl} controls style={{ marginTop: 8 }} />}

          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, textAlign: "right" }}>{fmtTime(message.createdAt)}</div>

          {message.reactions && Object.values(message.reactions).filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {Object.entries(message.reactions).filter(([_, v]) => v).map(([uid, emoji], i) => (
                <span key={i} style={{ background: COLORS.reactionBg, color: "#fff", padding: "0 7px", borderRadius: 14, fontSize: 12 }}>{emoji}</span>
              ))}
            </div>
          )}
        </div>

        {showReactions && (
          <div
            style={{
              position: "absolute", top: emojiPos.top, left: emojiPos.left, transform: "translate(-50%, -100%)",
              background: isDark ? COLORS.darkCard : COLORS.lightCard, borderRadius: 30, padding: 8, display: "flex", gap: 8,
              boxShadow: "0 6px 22px rgba(0,0,0,0.18)", zIndex: 1200,
            }}
            onMouseLeave={() => setShowReactions(false)}
          >
            {QUICK_REACTIONS.map((e) => (
              <button key={e} onClick={() => applyReaction(e)} style={{ fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}>{e}</button>
            ))}
            <button onClick={() => { setShowReactions(false); setShowEmojiPicker(true); }} style={{ fontSize: 20, border: "none", background: "transparent", cursor: "pointer" }}>➕</button>
          </div>
        )}

        {showEmojiPicker && <EmojiPicker position={emojiPos} onSelect={applyReaction} onClose={() => setShowEmojiPicker(false)} isDark={isDark} />}
      </div>

      {showBottomSheet && (
        <>
          <div className="sheet-backdrop" onClick={closeBottomSheet} />
          <div className="bottom-sheet" role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <div className="sheet-actions">
              <button className="sheet-action" onClick={() => { setReplyTo(message); toast.info("Replying…"); closeBottomSheet(); }}>↩️ Reply</button>
              <button className="sheet-action" onClick={copyMessage}>📋 Copy</button>
              <button className="sheet-action" onClick={togglePin}>📌 {pinnedMessage?.id === message.id ? "Unpin" : "Pin"}</button>
              {isMine && <button className="sheet-action danger" onClick={deleteMessageForEveryone}>🗑️ Delete for everyone</button>}
              <button className="sheet-action" onClick={closeBottomSheet}>Close</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}