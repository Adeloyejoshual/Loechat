import React, { useRef, useEffect, useState, forwardRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";

/* -------------------- CONSTANTS -------------------- */
const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

/* -------------------- SAFE HAPTICS -------------------- */
const hapticImpact = async (style = "Light") => {
  try {
    if (!window.Capacitor?.isNativePlatform()) return;
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle[style] });
  } catch {
    // silent on web
  }
};

/* -------------------- TIME FORMAT -------------------- */
const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/* ==================================================== */

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
  const [status, setStatus] = useState(message.status || "sent");
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  /* -------------------- REALTIME MESSAGE UPDATES -------------------- */
  useEffect(() => {
    if (!message?.id || !message?.chatId) return;

    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    const unsub = onSnapshot(msgRef, (snap) => {
      const data = snap.data();
      if (!data) return;

      setLocalReactions(data.reactions || {});

      if (isMine) {
        if (data.seenBy?.length) setStatus("seen");
        else if (data.deliveredTo?.length) setStatus("delivered");
        else setStatus(data.status || "sent");
      }
    });

    return () => unsub();
  }, [message.id, message.chatId, isMine]);

  /* -------------------- LONG PRESS -------------------- */
  const startLongPress = () => {
    if (longPressTimer.current) return;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setLongPressOpen(true);
      hapticImpact("Medium");
    }, LONG_PRESS_DELAY);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /* -------------------- SWIPE TO REPLY -------------------- */
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
      hapticImpact("Light");
    }
    setSwipeX(0);
    setSwipeActive(false);
  };

  /* -------------------- REACTIONS -------------------- */
  const toggleReaction = async (emoji) => {
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);

    setLocalReactions((prev) => {
      const updated = { ...prev };
      const users = updated[emoji] || [];

      if (users.includes(myUid)) {
        const rest = users.filter((u) => u !== myUid);
        if (rest.length === 0) delete updated[emoji];
        else updated[emoji] = rest;
      } else {
        updated[emoji] = [...users, myUid];
      }
      return updated;
    });

    hapticImpact("Light");

    try {
      const users = localReactions[emoji] || [];
      if (users.includes(myUid))
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      else
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
    } catch {
      toast.error("Reaction failed");
    }
  };

  /* -------------------- STATUS TICKS -------------------- */
  const renderStatus = () => {
    if (!isMine) return null;
    if (status === "sending") return "⏳";
    if (status === "sent") return "✓";
    if (status === "delivered") return "✓✓";
    if (status === "seen") return <span style={{ color: "#22c55e" }}>✓✓</span>;
  };

  if (message.deleted) return null;

  /* ==================== UI ==================== */
  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onClick={() => message.replyTo?.id && onReplyClick?.(message.replyTo.id)}
      style={{
        alignSelf: isMine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        margin: "6px 0",
        padding: 12,
        borderRadius: 16,
        background: isMine
          ? isDark ? "#0b6cff" : "#007bff"
          : isDark ? "#1f1f1f" : "#fff",
        color: isMine ? "#fff" : isDark ? "#fff" : "#111",
        transform: `translateX(${swipeX}px)`,
        transition: swipeX ? "none" : "transform 0.18s ease",
        userSelect: "none",
      }}
    >
      {!isMine && (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
          {friendName}
        </div>
      )}

      {message.text && (
        <div style={{ whiteSpace: "pre-wrap" }}>
          {message.text.slice(0, visibleChars)}
          {message.text.length > visibleChars && (
            <span
              onClick={() => setVisibleChars((v) => v + READ_MORE_STEP)}
              style={{ marginLeft: 6, opacity: 0.7, cursor: "pointer" }}
            >
              …more
            </span>
          )}
        </div>
      )}

      {/* Reactions */}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {QUICK_EMOJIS.map((e) => (
          <button key={e} onClick={() => toggleReaction(e)}>
            {e} {localReactions[e]?.length || ""}
          </button>
        ))}
        <button onClick={() => setEmojiPickerOpen((v) => !v)}>+</button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.7, textAlign: "right", marginTop: 6 }}>
        {fmtTime(message.createdAt)} {renderStatus()}
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