// src/components/Chat/MessageItem.jsx
import React, { useRef, useEffect, useState } from "react";
import {
  doc,
  updateDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import LongPressMessageModal from "./LongPressMessageModal";
import EmojiPicker from "./EmojiPicker";
import { toast } from "react-toastify";

const READ_MORE_STEP = 450;
const LONG_PRESS_DELAY = 700;
const SWIPE_TRIGGER_DISTANCE = 60;

const fmtTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function MessageItem({
  message,
  myUid,
  isDark,
  setReplyTo,
  setPinnedMessage,
  onMediaClick,
  registerRef,
  chatContainerRef, // <-- parent scroll container
}) {
  const isMine = message.senderId === myUid;
  const containerRef = useRef(null);

  const [visibleChars, setVisibleChars] = useState(READ_MORE_STEP);
  const [swipeX, setSwipeX] = useState(0);
  const [swipeActive, setSwipeActive] = useState(false);
  const [longPressOpen, setLongPressOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactionAnim, setReactionAnim] = useState({ show: false, emoji: "" });
  const [localReactions, setLocalReactions] = useState(message.reactions || {});

  const longPressTimer = useRef(null);
  const touchStartX = useRef(0);

  // keep local reactions in sync
  useEffect(() => {
    setLocalReactions(message.reactions || {});
  }, [message.reactions]);

  // register for scroll-to
  useEffect(() => {
    if (containerRef.current && registerRef) registerRef(containerRef.current);
  }, [registerRef]);

  // --------- smart auto-scroll ---------
  useEffect(() => {
    if (!chatContainerRef?.current || !containerRef.current) return;

    const container = chatContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const scrollThreshold = 120; // px considered "near bottom"

    if (distanceFromBottom < scrollThreshold) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [message.createdAt, chatContainerRef]);

  // --------- long press / swipe ----------
  const startLongPress = () => {
    if (longPressOpen || emojiOpen) return;
    longPressTimer.current = setTimeout(() => {
      setLongPressOpen(true);
      setEmojiOpen(false);
    }, LONG_PRESS_DELAY);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setSwipeActive(true);
    startLongPress();
  };

  const onTouchMove = (e) => {
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

  // --------- reactions ----------
  const toggleReaction = async (emoji) => {
    if (!message?.id || !message?.chatId) return;
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    try {
      const snap = await getDoc(msgRef);
      const data = snap.data() || {};
      const users = data.reactions?.[emoji] || [];
      const reacted = users.includes(myUid);

      if (reacted) {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayRemove(myUid) });
      } else {
        await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(myUid) });
      }

      setReactionAnim({ show: true, emoji });
      setTimeout(() => setReactionAnim({ show: false, emoji: "" }), 700);
    } catch (err) {
      console.error("toggleReaction", err);
      toast.error("Failed to react");
    }
  };

  // --------- pin / edit / delete / copy ----------
  const pinMessage = async () => {
    if (!message?.id || !message?.chatId) return;
    try {
      const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
      await updateDoc(msgRef, { pinned: true, pinnedAt: serverTimestamp(), pinnedBy: myUid });
      try { await updateDoc(doc(db, "chats", message.chatId), { pinnedMessageId: message.id }); } catch {}
      setPinnedMessage?.(message);
      toast.success("Pinned message");
    } catch (err) {
      console.error("pinMessage", err);
      toast.error("Pin failed");
    }
  };

  const editMessage = async () => {
    if (!isMine) return toast.info("You can only edit your messages");
    const newText = window.prompt("Edit message:", message.text || "");
    if (newText == null) return;
    try {
      await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), {
        text: newText,
        editedAt: serverTimestamp(),
        editedBy: myUid,
      });
      toast.success("Message edited");
      setLongPressOpen(false);
    } catch (err) {
      console.error("editMessage", err);
      toast.error("Edit failed");
    }
  };

  const deleteForEveryone = async () => {
    try {
      await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: myUid,
      });
      toast.success("Deleted for everyone");
      setLongPressOpen(false);
    } catch (err) {
      console.error("deleteForEveryone", err);
      toast.error("Delete failed");
    }
  };

  const deleteForMe = async () => {
    try {
      await updateDoc(doc(db, "chats", message.chatId, "messages", message.id), {
        deletedFor: arrayUnion(myUid),
      });
      toast.info("Deleted for you");
      setLongPressOpen(false);
    } catch (err) {
      console.error("deleteForMe", err);
      toast.error("Failed");
    }
  };

  const copyText = () => {
    try {
      navigator.clipboard.writeText(message.text || "");
      toast.success("Copied");
      setLongPressOpen(false);
    } catch {
      toast.error("Copy failed");
    }
  };

  // --------- media rendering ----------
  const mediaArray = message.mediaUrls || (message.mediaUrl ? [message.mediaUrl] : []);
  const renderMediaGrid = () => {
    if (!mediaArray.length) return null;
    const maxVisible = 4;
    const extra = Math.max(0, mediaArray.length - maxVisible);

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            mediaArray.length === 1
              ? "1fr"
              : mediaArray.length === 2
              ? "1fr 1fr"
              : "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 6,
          marginBottom: 8,
          position: "relative",
        }}
      >
        {mediaArray.slice(0, maxVisible).map((url, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
            <img
              src={url}
              alt=""
              onClick={() => onMediaClick?.(message, i)}
              style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            />
            {message.status === "sending" && message.uploadProgress != null && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.28)", color: "#fff", fontWeight: 700
              }}>{message.uploadProgress}%</div>
            )}
          </div>
        ))}
        {extra > 0 && (
          <div style={{
            position: "absolute", right: 10, bottom: 10, backgroundColor: "rgba(0,0,0,0.5)",
            color: "#fff", padding: "6px 8px", borderRadius: 10, fontWeight: 700
          }}>{`+${extra}`}</div>
        )}
      </div>
    );
  };

  if (message.deleted || (message.deletedFor && message.deletedFor.includes?.(myUid))) return null;

  return (
    <>
      <div
        ref={containerRef}
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
          backgroundColor: isMine ? "#007bff" : isDark ? "#222" : "#fff",
          color: isMine ? "#fff" : isDark ? "#fff" : "#000",
          transform: `translateX(${swipeX}px)`,
          transition: swipeX ? "none" : "transform 0.18s ease",
          wordBreak: "break-word",
          position: "relative",
          userSelect: "none",
          boxShadow: isMine ? "0 1px 0 rgba(0,0,0,0.12)" : "none",
        }}
      >
        {renderMediaGrid()}
        {message.text && (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {message.text.slice(0, visibleChars)}
            {message.text.length > visibleChars && (
              <span
                onClick={() => setVisibleChars((v) => v + READ_MORE_STEP)}
                style={{ color: "#888", cursor: "pointer", marginLeft: 6 }}
              >
                ...more
              </span>
            )}
          </div>
        )}

        {/* reactions summary */}
        {localReactions && Object.keys(localReactions).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {Object.entries(localReactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                title={`${users.length} reaction${users.length > 1 ? "s" : ""}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: 14,
                  background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 16 }}>{emoji}</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, opacity: 0.6, textAlign: "right", marginTop: 8 }}>
          {fmtTime(message.createdAt)}{message.editedAt ? " • edited" : ""}
        </div>

        {reactionAnim.show && (
          <div style={{
            position: "absolute", top: -20, right: 10, fontSize: 20,
            animation: "floatUp 0.8s ease-out forwards", pointerEvents: "none"
          }}>
            {reactionAnim.emoji}
          </div>
        )}
      </div>

      {/* Long press modal */}
      {longPressOpen && (
        <LongPressMessageModal
          isDark={isDark}
          onClose={() => setLongPressOpen(false)}
          onReaction={(emoji) => { toggleReaction(emoji); setLongPressOpen(false); }}
          onReply={() => { setReplyTo?.(message); setLongPressOpen(false); }}
          onCopy={copyText}
          onPin={async () => { await pinMessage(); setLongPressOpen(false); }}
          onDeleteForMe={async () => { await deleteForMe(); setLongPressOpen(false); }}
          onDeleteForEveryone={async () => { await deleteForEveryone(); setLongPressOpen(false); }}
          message={message}
          onMediaClick={(m, i) => { onMediaClick?.(m, i); setLongPressOpen(false); }}
        />
      )}

      {/* Emoji picker */}
      {emojiOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 4000, display: "flex", justifyContent: "center", alignItems: "flex-end", padding: 12 }}>
          <div style={{ width: "100%", maxWidth: 500 }}>
            <EmojiPicker
              onSelect={(emoji) => { toggleReaction(emoji); setEmojiOpen(false); }}
              onClose={() => setEmojiOpen(false)}
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `}</style>
    </>
  );
}