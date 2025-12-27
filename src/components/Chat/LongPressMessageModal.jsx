// src/components/Chat/LongPressMessageModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
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
  anchorRect,
}) {
  const modalRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const reactions = message.reactions || {};

  /* ---------------- POSITION ---------------- */
  useEffect(() => {
    if (!anchorRect || !modalRef.current) return;
    const h = modalRef.current.offsetHeight;
    setPosition({
      top: Math.max(anchorRect.top - h - 8, 8),
      left: anchorRect.left + anchorRect.width / 2,
      transform: "translateX(-50%)",
    });
  }, [anchorRect]);

  const [position, setPosition] = useState({
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
  });

  /* ---------------- REACTIONS ---------------- */
  const toggleReaction = async (emoji) => {
    const ref = doc(db, "chats", chatId, "messages", message.id);
    const users = reactions[emoji] || [];
    const hasReacted = users.includes(myUid);

    if (hasReacted && users.length === 1) {
      // remove entire emoji field
      await updateDoc(ref, {
        [`reactions.${emoji}`]: null,
      });
    } else {
      await updateDoc(ref, {
        [`reactions.${emoji}`]: hasReacted
          ? users.filter((u) => u !== myUid)
          : [...users, myUid],
      });
    }
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

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          transform: position.transform,
          width: "92%",
          maxWidth: 360,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 14,
          zIndex: 9999,
          boxShadow: "0 8px 30px rgba(0,0,0,.35)",
        }}
      >
        {/* Preview */}
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

        {/* Reactions */}
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