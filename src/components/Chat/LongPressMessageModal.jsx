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
  onDeleteMessage,
  onReactionChange,
}) {
  const [reactions, setReactions] = useState(message.reactions || {});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => setReactions(message.reactions || {}), [message.reactions]);

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  // Toggle reaction in Firestore
  const toggleReaction = async (emoji) => {
    const msgRef = doc(db, "chats", chatId, "messages", message.id);
    const hasReacted = reactions[emoji]?.includes(myUid);
    const newReactions = { ...reactions };

    if (hasReacted) {
      newReactions[emoji] = newReactions[emoji].filter((u) => u !== myUid);
      if (newReactions[emoji].length === 0) delete newReactions[emoji];
    } else {
      newReactions[emoji] = [...(newReactions[emoji] || []), myUid];
    }

    setReactions(newReactions);
    onReactionChange?.(newReactions);

    try {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(myUid) : arrayUnion(myUid),
      });
    } catch (err) {
      console.error("Failed to update reaction:", err);
      toast.error("Failed to update reaction");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text || "");
      toast.success("Message copied!");
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, "chats", chatId, "messages", message.id));
      toast.success("Message deleted");
      onDeleteMessage?.(message.id);
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete message");
    }
  };

  const handlePinToggle = async () => {
    try {
      const chatRef = doc(db, "chats", chatId);
      if (pinnedMessage?.id === message.id) {
        // Unpin
        await updateDoc(chatRef, { pinnedMessageId: null });
        setPinnedMessage(null);
      } else {
        // Pin
        await updateDoc(chatRef, { pinnedMessageId: message.id });
        setPinnedMessage(message);
      }
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update pin");
    }
  };

  const handleEmojiSelect = (emoji) => {
    toggleReaction(emoji);
    setShowEmojiPicker(false);
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: 360,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
          zIndex: 10000,
        }}
      >
        {/* Message Preview */}
        <div
          style={{
            fontSize: 14,
            color: isDark ? "#eee" : "#111",
            wordBreak: "break-word",
            maxHeight: 60,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {message.text || "Media message"}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <ActionButton
            label="Reply"
            isDark={isDark}
            onClick={() => {
              setReplyTo?.(message);
              onClose();
            }}
          />

          <ActionButton
            label={pinnedMessage?.id === message.id ? "Unpin" : "Pin"}
            isDark={isDark}
            onClick={handlePinToggle}
          />

          <ActionButton label="Copy" isDark={isDark} onClick={handleCopy} />
          <ActionButton label="Delete" isDark={isDark} onClick={handleDelete} />
        </div>

        {/* Quick emoji reactions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {QUICK_EMOJIS.map((emoji) => {
            const selected = reactions[emoji]?.includes(myUid);
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                style={{
                  padding: 6,
                  fontSize: 18,
                  borderRadius: 10,
                  border: selected ? "2px solid #4a90e2" : "1px solid #ccc",
                  background: selected ? "#4a90e2" : isDark ? "#2a2a2a" : "#f5f5f5",
                  color: selected ? "#fff" : isDark ? "#eee" : "#111",
                  cursor: "pointer",
                  minWidth: 40,
                  textAlign: "center",
                }}
              >
                {emoji} {reactions[emoji]?.length || ""}
              </button>
            );
          })}

          <button
            onClick={() => setShowEmojiPicker(true)}
            style={{
              padding: 6,
              fontSize: 18,
              borderRadius: 10,
              border: "1px solid #ccc",
              background: isDark ? "#2a2a2a" : "#f5f5f5",
              color: isDark ? "#eee" : "#111",
              cursor: "pointer",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            +
          </button>
        </div>

        {/* Close button */}
        <ActionButton label="Close" isDark={isDark} onClick={onClose} />
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          open={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onSelect={handleEmojiSelect}
          isDark={isDark}
          maxHeightPct={0.5}
        />
      )}
    </>
  );
}

const ActionButton = ({ label, onClick, isDark }) => (
  <button
    onClick={onClick}
    style={{
      padding: 12,
      borderRadius: 12,
      background: isDark ? "#333" : "#eee",
      color: isDark ? "#fff" : "#111",
      border: "none",
      textAlign: "left",
      fontSize: 14,
      cursor: "pointer",
      width: "100%",
    }}
  >
    {label}
  </button>
);