// src/components/Chat/MessageItem.jsx
import React, { useRef, useEffect, useState, forwardRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import LongPressMessageModal from "./LongPressMessageModal";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

// Quick emojis for reactions bar
const QUICK_EMOJIS = ["👍","❤️","😂","😮","😢"];

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
  chatContainerRef,
  onReplyClick,
  friendName,
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

  // ----------------- Live updates -----------------
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

  // ----------------- Swipe / Long press -----------------
  const startLongPress = () => {
    if (longPressTimer.current) return;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setLongPressOpen(true);
      Haptics.impact({ style: ImpactStyle.Medium });
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
    if (isMine) startLongPress();
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
    if (swipeActive && isMine && Math.abs(swipeX) > SWIPE_TRIGGER_DISTANCE) {
      setReplyTo?.(message);
      Haptics.impact({ style: ImpactStyle.Light });
    }
    setSwipeX(0);
    setSwipeActive(false);
  };

  // ----------------- Toggle reaction -----------------
  const toggleReaction = async (emoji) => {
    if (!message?.id || !message?.chatId) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);

    setLocalReactions(prev => {
      const updated = { ...prev };
      const users = updated[emoji] || [];
      if (users.includes(myUid)) {
        const remaining = users.filter(u => u !== myUid);
        if (remaining.length === 0) delete updated[emoji]; // auto-remove empty
        else updated[emoji] = remaining;
      } else {
        updated[emoji] = [...users, myUid];
      }
      return updated;
    });

    Haptics.impact({ style: ImpactStyle.Light });

    try {
      const snap = await msgRef.get();
      const users = snap.data()?.reactions?.[emoji] || [];
      if (users.includes(myUid)) await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      else await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
    } catch {
      toast.error("Failed to react");
    }
  };

  // ----------------- Status tick -----------------
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

  // ----------------- Reactions bar (quick 5) -----------------
  const reactionPills = () => {
    const emojisToShow = QUICK_EMOJIS.slice(0,5);
    return (
      <div style={{ display:"flex", gap:8, marginTop:6 }}>
        {emojisToShow.map(e => (
          <button key={e} onClick={() => toggleReaction(e)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap:4,
              padding:"2px 6px",
              borderRadius:14,
              background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              border:"none",
              cursor:"pointer",
              fontSize:14
            }}>
            <span style={{ fontSize:16 }}>{e}</span>
            {localReactions[e]?.length > 0 && <span style={{ fontSize:12, opacity:0.85 }}>{localReactions[e].length}</span>}
          </button>
        ))}
        <button onClick={() => setEmojiPickerOpen(true)} style={{ fontSize:16, background:"transparent", border:"none", cursor:"pointer" }}>+</button>
      </div>
    );
  };

  const emojiPicker = emojiPickerOpen && (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", padding:6,
                  background:isDark ? "#222" : "#f1f1f1", borderRadius:12, marginTop:4 }}>
      {["👍","❤️","😂","😮","😢","👏","🎉","🔥"].map(e => (
        <span key={e} style={{ cursor:"pointer", fontSize:18 }}
              onClick={() => { toggleReaction(e); setEmojiPickerOpen(false); }}>{e}</span>
      ))}
    </div>
  );

  // ----------------- Media rendering -----------------
  const renderMedia = () => {
    if (!message.mediaUrl) return null;
    const type = message.mediaType || "";
    if (type.startsWith("image")) return <img src={message.mediaUrl} alt="media" style={{ maxWidth:"100%", borderRadius:12, marginTop:6, cursor:"pointer" }} onClick={() => chatContainerRef?.current?.scrollTo({ top: containerRef.current.offsetTop, behavior:"smooth" })} />;
    if (type.startsWith("video")) return <video src={message.mediaUrl} controls style={{ maxWidth:"100%", borderRadius:12, marginTop:6 }} />;
    return null;
  };

  // ----------------- Click reply navigation -----------------
  const handleClick = () => {
    if (message.replyTo?.id) {
      onReplyClick?.(message.replyTo.id);
    }
  };

  if (message.deleted || (message.deletedFor && message.deletedFor.includes?.(myUid))) return null;

  return (
    <div
      ref={containerRef}
      data-id={message.id}
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      style={{
        alignSelf:isMine ? "flex-end" : "flex-start",
        maxWidth:"78%",
        margin:"6px 0",
        padding:12,
        borderRadius:16,
        backgroundColor:isMine ? (isDark ? "#0b6cff" : "#007bff") : isDark ? "#1f1f1f" : "#fff",
        color:isMine ? "#fff" : isDark ? "#fff" : "#111",
        transform:`translateX(${swipeX}px)`,
        transition: swipeX ? "none" : "transform 0.18s ease",
        wordBreak:"break-word",
        position:"relative",
        boxShadow:isMine ? "0 6px 18px rgba(0,0,0,0.06)" : "0 1px 0 rgba(0,0,0,0.03)",
        userSelect:"none",
        cursor: message.replyTo?.id ? "pointer" : "default",
      }}
    >
      {/* Sender name if not mine */}
      {!isMine && <div style={{ fontSize:12, fontWeight:500, marginBottom:4, color:isDark?"#aaa":"#555" }}>{friendName}</div>}

      {/* Text */}
      {message.text && (
        <div style={{ whiteSpace:"pre-wrap", lineHeight:1.4, fontSize:15 }}>
          {message.text.slice(0, visibleChars)}
          {message.text.length > visibleChars && (
            <span onClick={() => setVisibleChars(v => v + READ_MORE_STEP)}
                  style={{ color:"#c4c4c4", cursor:"pointer", marginLeft:6 }}>...more</span>
          )}
        </div>
      )}

      {/* Media */}
      {renderMedia()}

      {/* Reactions */}
      {reactionPills()}
      {emojiPicker}

      {/* Time & Status */}
      <div style={{ fontSize:11, opacity:0.75, textAlign:"right", marginTop:8, display:"flex", justifyContent:"flex-end", gap:8, alignItems:"center" }}>
        <div style={{ color:isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.6)" }}>{fmtTime(message.createdAt)}</div>
        {tickElement()}
      </div>

      {/* Reaction float animation */}
      {reactionAnim.show && <div style={{ position:"absolute", top:-18, right:10, fontSize:20, animation:"floatUp 0.7s ease-out forwards", pointerEvents:"none" }}>{reactionAnim.emoji}</div>}

      {/* Long press modal */}
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
          0% { opacity:1; transform:translateY(0); }
          100% { opacity:0; transform:translateY(-24px); }
        }
      `}</style>
    </div>
  );
});

export default MessageItem;