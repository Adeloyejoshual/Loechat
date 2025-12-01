import React, { useState, useRef, useEffect } from "react";
import EmojiPicker from "./EmojiPicker";

export default function LongPressMessageModal({
  onClose,
  onReaction,
  onReply,
  onCopy,
  onPin,
  onDelete,
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
  isDark = false,
  messageSenderName = "you",
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: 10,
        right: 10,
        display: "flex",
        justifyContent: "center",
        zIndex: 3000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: isDark ? "#1b1b1b" : "#fff",
          borderRadius: 16,
          boxShadow: "0 6px 22px rgba(0,0,0,0.25)",
          padding: 12,
          width: "100%",
          maxWidth: 360,
          animation: "slideFadeIn 150ms ease-out",
        }}
      >
        {!confirmDelete ? (
          <>
            {/* Quick Reactions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { onReaction(emoji); onClose(); }}
                  style={{
                    fontSize: 22,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                style={{ fontSize: 22, border: "none", background: "transparent", cursor: "pointer" }}
              >
                ➕
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(e) => { onReaction(e); onClose(); }}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={onReply} style={{ padding: 8, cursor: "pointer" }}>↩️ Reply</button>
              <button onClick={onCopy} style={{ padding: 8, cursor: "pointer" }}>📋 Copy</button>
              <button onClick={onPin} style={{ padding: 8, cursor: "pointer" }}>📌 Pin</button>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ padding: 8, cursor: "pointer", color: "red" }}
              >
                🗑️ Delete
              </button>
              <button onClick={onClose} style={{ padding: 8, cursor: "pointer" }}>Close</button>
            </div>
          </>
        ) : (
          /* Delete Confirmation */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 14, textAlign: "center" }}>
              Are you sure you want to delete this message?
            </div>
            <div style={{ fontSize: 12, textAlign: "center", color: "#888" }}>
              Delete for {messageSenderName}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ padding: 8, cursor: "pointer", borderRadius: 8, border: "1px solid #ccc" }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onDelete(); onClose(); }}
                style={{ padding: 8, cursor: "pointer", borderRadius: 8, backgroundColor: "red", color: "#fff" }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Animation Keyframes */}
      <style>
        {`
        @keyframes slideFadeIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        `}
      </style>
    </div>
  );
}