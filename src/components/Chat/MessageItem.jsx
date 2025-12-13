import React, { useRef, useEffect, useState, forwardRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";

/* ---------------- CONSTANTS ---------------- */
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;
const READ_MORE_CHARS = 300;

/* ---------------- SAFE HAPTIC (WEB) ---------------- */
const haptic = (ms = 20) => {
  if (navigator?.vibrate) navigator.vibrate(ms);
};

/* ---------------- TIME ---------------- */
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/* ================================================= */

const MessageItem = forwardRef(function MessageItem(
  {
    message,
    myUid,
    isDark,
    setReplyTo,
    setPinnedMessage,
    friendName,
  },
  ref
) {
  const isMine = message.senderId === myUid;
  const containerRef = ref || useRef(null);

  const [showFullText, setShowFullText] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [status, setStatus] = useState("sent");
  const [longPressOpen, setLongPressOpen] = useState(false);

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  /* ---------- REAL-TIME STATUS & REACTIONS ---------- */
  useEffect(() => {
    if (!message?.id || !message?.chatId) return;
    const ref = doc(db, "chats", message.chatId, "messages", message.id);

    const unsub = onSnapshot(ref, (snap) => {
      const d = snap.data();
      if (!d) return;

      setLocalReactions(d.reactions || {});

      // Real-time status for sender
      if (isMine) {
        if (d.seenBy?.includes?.(myUid)) setStatus("seen");
        else if (d.deliveredTo?.includes?.(myUid)) setStatus("delivered");
        else setStatus("sent");
      }
    });

    return () => unsub();
  }, [message.id, message.chatId, isMine, myUid]);

  /* ---------- LONG PRESS ---------- */
  const startLongPress = () => {
    if (longPressTimer.current) return;
    longPressTimer.current = setTimeout(() => {
      setLongPressOpen(true);
      haptic(30);
    }, LONG_PRESS_DELAY);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  /* ---------- SWIPE TO REPLY ---------- */
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
    startLongPress();
  };

  const onTouchMove = (e) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 10) cancelLongPress();
    if (swipeActive) setSwipeX(Math.max(Math.min(diff, 140), -140));
  };

  const onTouchEnd = () => {
    cancelLongPress();
    if (Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
      setReplyTo?.(message);
      haptic(20);
    }
    setSwipeX(0);
    setSwipeActive(false);
  };

  if (message.deleted) return null;

  const isLongText = message.text && message.text.length > READ_MORE_CHARS;
  const displayedText = !isLongText || showFullText ? message.text : message.text.slice(0, READ_MORE_CHARS) + "...";

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "85%",
        width: "auto",
        padding: 12,
        margin: "6px 0",
        borderRadius: 16,
        background: isMine ? (isDark ? "#0b6cff" : "#007bff") : isDark ? "#2a2a2a" : "#f5f5f5",
        color: isMine ? "#fff" : isDark ? "#ddd" : "#111",
        transform: `translateX(${swipeX}px)`,
        transition: swipeX ? "none" : "transform 0.18s",
        wordBreak: "break-word",
        fontSize: 14,
      }}
    >
      {!isMine && friendName && <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{friendName}</div>}

      <div>
        {displayedText}
        {isLongText && !showFullText && (
          <span
            onClick={() => setShowFullText(true)}
            style={{ color: "#4a90e2", cursor: "pointer", marginLeft: 4 }}
          >
            Read more
          </span>
        )}
      </div>

      <div style={{ fontSize: 11, opacity: 0.6, textAlign: "right", marginTop: 4 }}>
        {fmtTime(message.createdAt)}{" "}
        {isMine && (status === "seen" ? "✓✓" : status === "delivered" ? "✓✓" : "✓")}
      </div>

      {longPressOpen && (
        <LongPressMessageModal
          message={message}
          myUid={myUid}
          onClose={() => setLongPressOpen(false)}
          setReplyTo={setReplyTo}
          setPinnedMessage={setPinnedMessage}
          localReactions={localReactions} // pass reactions
        />
      )}
    </div>
  );
});

export default MessageItem;