import React, { useRef, useEffect, useState, forwardRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

// Simple emojis for picker
const EMOJIS = ["👍","❤️","😂","😮","😢","👏","🎉","🔥"];

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageItem = forwardRef(function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  chatContainerRef,
}, ref) {
  const isMine = message.senderId === myUid;
  const containerRef = ref || useRef(null);
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "" });
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [status, setStatus] = useState(message.status || (isMine ? "sending" : "sent"));
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  // Subscribe to live updates
  useEffect(() => {
    if (!message?.id || !message?.chatId) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    const unsub = onSnapshot(msgRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      setLocalReactions(data.reactions || {});
      if (isMine) {
        if (Array.isArray(data.seenBy) && data.seenBy.length > 0) setStatus("seen");
        else if (Array.isArray(data.deliveredTo) && data.deliveredTo.length > 0) setStatus("delivered");
        else setStatus(data.status || "sent");
      }
    });
    return () => unsub();
  }, [message?.id, message?.chatId, isMine]);

  // Swipe / Long press handlers
  const startLongPress = () => {
    if (longPressTimer.current) return;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setLongPressOpen(true);
    }, LONG_PRESS_DELAY);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const onTouchStart = (e) => {
    if (!e.touches?.[0]) return;
    touchStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
    startLongPress();
  };
  const onTouchMove = (e) => {
    if (!e.touches?.[0]) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 10) cancelLongPress();
    if (!swipeActive) return;
    setSwipeX(Math.max(Math.min(diff, 140), -140));
  };
  const onTouchEnd = () => {
    cancelLongPress();
    if (swipeActive && Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
      setReplyTo?.(message);
    }
    setSwipeX(0);
    setSwipeActive(false);
  };

  // Toggle reaction (live for both users)
  const toggleReaction = async (emoji) => {
    if (!message?.id || !message?.chatId) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    const users = localReactions[emoji] || [];
    const reacted = users.includes(myUid);
    try {
      if (reacted) await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      else await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      setReactionAnim({ show: true, emoji });
      setTimeout(() => setReactionAnim({ show: false, emoji: "" }), 700);
    } catch {
      toast.error("Failed to react");
    }
  };

  const tickElement = () => {
    if (!isMine) return null;
    switch (status) {
      case "sending": return <span style={{ marginLeft: 8 }}>⏳</span>;
      case "sent": return <span style={{ marginLeft: 0 }}>✓</span>;
      case "delivered": return <span style={{ marginLeft: 0 }}>✓✓</span>;
      case "seen": return <span style={{ marginLeft: 0, color: "#22c55e" }}>✓✓</span>;
      default: return null;
    }
  };

  const reactionPills = () => {
    if (!localReactions || Object.keys(localReactions).length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {Object.entries(localReactions).map(([emoji, users]) => (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 6px",
              borderRadius: 14,
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              border: "none",
              cursor: "pointer",
              fontSize: 14
            }}
          >
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{users.length}</span>
          </button>
        ))}
        {/* + Button */}
        <button onClick={() => setEmojiPickerOpen(prev => !prev)} style={{ fontSize: 16, background: "transparent", border: "none", cursor: "pointer" }}>+</button>
      </div>
    );
  };

  const emojiPicker = emojiPickerOpen && (
    <div style={{
      display: "flex", gap: 6, flexWrap: "wrap", padding: 6,
      background: isDark ? "#222" : "#f1f1f1", borderRadius: 12, marginTop: 4
    }}>
      {EMOJIS.map((e) => (
        <span
          key={e}
          style={{ cursor: "pointer", fontSize: 18 }}
          onClick={() => { toggleReaction(e); setEmojiPickerOpen(false); }}
        >{e}</span>
      ))}
    </div>
  );

  if (message.deleted || (message.deletedFor && message.deletedFor.includes?.(myUid))) return null;

  return (
    <div
      ref={containerRef}
      data-id={message.id}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        margin: "6px 0",
        padding: 12,
        borderRadius: 16,
        backgroundColor: isMine ? (isDark ? "#0b6cff" : "#007bff") : isDark ? "#1f1f1f" : "#fff",
        color: isMine ? "#fff" : isDark ? "#fff" : "#111",
        transform: `translateX(${swipeX}px)`,
        transition: swipeX ? "none" : "transform 0.18s ease",
        wordBreak: "break-word",
        position: "relative",
        boxShadow: isMine ? "0 6px 18px rgba(0,0,0,0.06)" : "0 1px 0 rgba(0,0,0,0.03)",
        userSelect: "none",
      }}
    >
      {message.text && (
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, fontSize: 15 }}>
          {message.text.slice(0, visibleChars)}
          {message.text.length > visibleChars && (
            <span onClick={() => setVisibleChars(v => v + READ_MORE_STEP)} style={{ color: "#c4c4c4", cursor: "pointer", marginLeft: 6 }}>...more</span>
          )}
        </div>
      )}

      {reactionPills()}
      {emojiPicker}

      <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
        <div style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)" }}>{fmtTime(message.createdAt)}</div>
        {tickElement()}
      </div>

      {reactionAnim.show && <div style={{ position: "absolute", top: -18, right: 10, fontSize: 20, animation: "floatUp 0.7s ease-out forwards", pointerEvents: "none" }}>{reactionAnim.emoji}</div>}

      {longPressOpen && (
        <LongPressMessageModal
          message={message}
          myUid={myUid}
          onClose={() => setLongPressOpen(false)}
          setReplyTo={setReplyTo}
          setPinnedMessage={setPinnedMessage}
          chatContainerRef={chatContainerRef}
          onReactionChange={(newReactions) => setLocalReactions(newReactions)}
        />
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-24px); }
        }
      `}</style>
    </div>
  );
});

export default MessageItem;