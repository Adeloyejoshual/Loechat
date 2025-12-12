import React, { useRef, useEffect, useState } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const CheckSingle = ({ color = "gray", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M20.285 6.708L9 18l-5.285-5.292 1.414-1.414L9 15.172 18.87 5.293z" fill={color} />
  </svg>
);
const CheckDouble = ({ color = "gray", size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M16.97 6.58L15.56 5.17 9 11.73 6.44 9.17 5.03 10.58 9 14.55zM21.03 6.58L19.62 5.17 13.06 11.73 10.5 9.17 9.09 10.58 13.06 14.55z" fill={color} />
  </svg>
);

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  registerRef,
  chatContainerRef,
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);
  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "" });
  const [localReactions, setLocalReactions] = useState(message.reactions || {});
  const [status, setStatus] = useState(message.status || (isMine ? "sending" : "sent"));
  const [longPressOpen, setLongPressOpen] = useState(false);

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  useEffect(() => setLocalReactions(message.reactions || {}), [message.reactions]);

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

  // Swipe to reply
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

  const toggleReaction = async (emoji) => {
    if (!message?.id || !message?.chatId) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      const snap = await getDoc(msgRef);
      const data = snap.data() || {};
      const users = data.reactions?.[emoji] || [];
      const reacted = users.includes(myUid);
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
      case "sent": return <CheckSingle color="gray" />;
      case "delivered": return <CheckDouble color="gray" />;
      case "seen": return <CheckDouble color="#22c55e" />;
      default: return null;
    }
  };

  const renderMediaGrid = () => {
    const mediaArray = message.mediaUrls || (message.mediaUrl ? [message.mediaUrl] : []);
    if (!mediaArray.length) return null;
    const maxVisible = 4;
    const extra = Math.max(0, mediaArray.length - maxVisible);
    const gridTemplate = mediaArray.length === 1 ? "1fr" : mediaArray.length === 2 ? "1fr 1fr" : "repeat(auto-fit,minmax(120px,1fr))";
    return (
      <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 6, marginBottom: 8, position: "relative" }}>
        {mediaArray.slice(0, maxVisible).map((url, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
            {/\.(mp4|webm|ogg)$/i.test(String(url)) ? (
              <video src={url} controls onClick={() => onMediaClick?.(message, i)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} />
            ) : (
              <img src={url} alt="" onClick={() => onMediaClick?.(message, i)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} draggable={false} />
            )}
          </div>
        ))}
        {extra > 0 && <div style={{ position: "absolute", right: 10, bottom: 10, background: "rgba(0,0,0,0.55)", color: "#fff", padding: "6px 8px", borderRadius: 10, fontWeight: 700 }}>+{extra}</div>}
      </div>
    );
  };

  const reactionPills = () => {
    if (!localReactions || Object.keys(localReactions).length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {Object.entries(localReactions).map(([emoji, users]) => (
          <button key={emoji} onClick={() => toggleReaction(emoji)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 16, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)", border: "none", cursor: "pointer", fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>{emoji}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{users.length}</span>
          </button>
        ))}
      </div>
    );
  };

  if (message.deleted || (message.deletedFor && message.deletedFor.includes?.(myUid))) return null;

  return (
    <>
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
        {renderMediaGrid()}

        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4, fontSize: 15 }}>
            {message.text.slice(0, visibleChars)}
            {message.text.length > visibleChars && (
              <span onClick={() => setVisibleChars(v => v + READ_MORE_STEP)} style={{ color: "#c4c4c4", cursor: "pointer", marginLeft: 6 }}>...more</span>
            )}
          </div>
        )}

        {reactionPills()}

        <div style={{ fontSize: 11, opacity: 0.75, textAlign: "right", marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
          <div style={{ color: isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)" }}>{fmtTime(message.createdAt)}</div>
          {tickElement()}
        </div>

        {reactionAnim.show && <div style={{ position: "absolute", top: -18, right: 10, fontSize: 20, animation: "floatUp 0.7s ease-out forwards", pointerEvents: "none" }}>{reactionAnim.emoji}</div>}
      </div>

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
    </>
  );
}