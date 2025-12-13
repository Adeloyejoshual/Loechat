import React, { useRef, useEffect, useState, forwardRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";

/* ---------------- CONSTANTS ---------------- */
const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

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
    onReplyClick,
    friendName,
  },
  ref
) {
  const isMine = message.senderId === myUid;
  const containerRef = ref || useRef(null);

  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [status, setStatus] = useState("sent");
  const [longPressOpen, setLongPressOpen] = useState(false);

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  /* ---------- REALTIME MESSAGE ---------- */
  useEffect(() => {
    if (!message?.id || !message?.chatId) return;
    const ref = doc(db, "chats", message.chatId, "messages", message.id);

    return onSnapshot(ref, (snap) => {
      const d = snap.data();
      if (!d) return;
      setLocalReactions(d.reactions || {});
      if (isMine) {
        if (d.seenBy?.length) setStatus("seen");
        else if (d.deliveredTo?.length) setStatus("delivered");
        else setStatus("sent");
      }
    });
  }, [message.id, message.chatId, isMine]);

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

  /* ---------- REACTIONS ---------- */
  const toggleReaction = async (emoji) => {
    const ref = doc(db, "chats", message.chatId, "messages", message.id);

    setLocalReactions((prev) => {
      const next = { ...prev };
      const users = next[emoji] || [];
      if (users.includes(myUid)) {
        const r = users.filter((u) => u !== myUid);
        r.length ? (next[emoji] = r) : delete next[emoji];
      } else {
        next[emoji] = [...users, myUid];
      }
      return next;
    });

    haptic(15);

    try {
      const users = localReactions[emoji] || [];
      await updateDoc(ref, {
        [`reactions.${emoji}`]: users.includes(myUid)
          ? arrayRemove(myUid)
          : arrayUnion(myUid),
      });
    } catch {
      toast.error("Reaction failed");
    }
  };

  if (message.deleted) return null;

  /* ================= UI ================= */
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
        maxWidth: "78%",
        padding: 12,
        margin: "6px 0",
        borderRadius: 16,
        background: isMine
          ? isDark ? "#0b6cff" : "#007bff"
          : isDark ? "#1f1f1f" : "#fff",
        color: isMine ? "#fff" : "#111",
        transform: `translateX(${swipeX}px)`,
        transition: swipeX ? "none" : "transform .18s",
      }}
    >
      {!isMine && (
        <div style={{ fontSize: 12, opacity: 0.6 }}>{friendName}</div>
      )}

      {message.text}

      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {QUICK_EMOJIS.map((e) => (
          <button key={e} onClick={() => toggleReaction(e)}>
            {e} {localReactions[e]?.length || ""}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, opacity: 0.7, textAlign: "right" }}>
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
        />
      )}
    </div>
  );
});

export default MessageItem;