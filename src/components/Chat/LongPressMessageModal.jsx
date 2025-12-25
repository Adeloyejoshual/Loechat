// src/components/Chat/LongPressMessageModal.jsx
import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import EmojiPicker from "./EmojiPicker";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export default function LongPressMessageModal({
  message,
  chatId,
  myUid,
  isDark = false,
  onClose,
  setReplyTo,
  pinnedMessage,
  setPinnedMessage,
  onReactionChange,
}) {
  const [reactions, setReactions] = useState(message.reactions || {});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    setReactions(message.reactions || {});
  }, [message.reactions]);

  /* ---------------- CLICK OUTSIDE (NO OVERLAY) ---------------- */
  useEffect(() => {
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [onClose]);

  /* ---------------- REACTIONS ---------------- */
  const toggleReaction = async (emoji) => {
    const ref = doc(db, "chats", chatId, "messages", message.id);
    const reacted = reactions[emoji]?.includes(myUid);

    const updated = { ...reactions };
    if (reacted) {
      updated[emoji] = updated[emoji].filter((u) => u !== myUid);
      if (updated[emoji].length === 0) delete updated[emoji];
    } else {
      updated[emoji] = [...(updated[emoji] || []), myUid];
    }

    setReactions(updated);
    onReactionChange?.(updated);

    await updateDoc(ref, {
      [`reactions.${emoji}`]: reacted
        ? arrayRemove(myUid)
        : arrayUnion(myUid),
    });
  };

  /* ---------------- ACTIONS ---------------- */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.text || "");
    toast.success("Copied");
    onClose();
  };

  const handleDelete = async () => {
    await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
    toast.success("Deleted");
    onClose();
  };

  const handlePin = async () => {
    const chatRef = doc(db, "chats", chatId);
    const isPinned = pinnedMessage?.id === message.id;

    await updateDoc(chatRef, {
      pinnedMessageId: isPinned ? null : message.id,
    });

    setPinnedMessage(isPinned ? null : message);
    toast.success(isPinned ? "Unpinned" : "Pinned");
    onClose();
  };

  /* ---------------- UI ---------------- */
  return (
    <>
      <div
        ref={modalRef}
        style={{
          position: "fixed",
          bottom: 70,
          left: "50%",
          transform: "translateX(-50%)",
          width: "92%",
          maxWidth: 360,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 14,
          zIndex: 10000,
          boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        }}
      >
        {/* Message preview */}
        <div
          style={{
            fontSize: 14,
            marginBottom: 10,
            opacity: 0.85,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {message.text || "Media message"}
        </div>

        {/* Quick emojis */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK_EMOJIS.map((e) => {
            const active = reactions[e]?.includes(myUid);
            return (
              <button
                key={e}
                onClick={() => toggleReaction(e)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  fontSize: 16,
                  border: active ? "2px solid #4a90e2" : "1px solid #ccc",
                  background: active ? "#4a90e2" : "transparent",
                  color: active ? "#fff" : isDark ? "#eee" : "#111",
                  cursor: "pointer",
                }}
              >
                {e} {reactions[e]?.length || ""}
              </button>
            );
          })}

          <button
            onClick={() => setShowEmojiPicker(true)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              fontSize: 16,
              border: "1px solid #ccc",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>

        <hr style={{ opacity: 0.2, margin: "12px 0" }} />

        <Action label="Reply" onClick={() => { setReplyTo(message); onClose(); }} />
        <Action
          label={pinnedMessage?.id === message.id ? "Unpin" : "Pin"}
          onClick={handlePin}
        />
        <Action label="Copy" onClick={handleCopy} />
        <Action danger label="Delete" onClick={handleDelete} />
      </div>

      {showEmojiPicker && (
        <EmojiPicker
          open
          onClose={() => setShowEmojiPicker(false)}
          onSelect={(e) => {
            toggleReaction(e);
            setShowEmojiPicker(false);
          }}
          isDark={isDark}
        />
      )}
    </>
  );
}

/* ---------------- BUTTON ---------------- */
const Action = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%",
      padding: 10,
      marginTop: 6,
      borderRadius: 10,
      border: "none",
      background: danger ? "#b00020" : "#2a2a2a",
      color: "#fff",
      textAlign: "left",
      cursor: "pointer",
    }}
  >
    {label}
  </button>
);