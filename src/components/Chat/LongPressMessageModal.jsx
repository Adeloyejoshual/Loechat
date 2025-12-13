import React, { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export default function LongPressMessageModal({
  message,
  myUid,
  isDark = false,
  onClose,
  setReplyTo,
  setPinnedMessage,
  localReactions = {},
}) {
  const [reactions, setReactions] = useState(localReactions);

  // Toggle emoji reaction
  const toggleReaction = async (emoji) => {
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);

    setReactions((prev) => {
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

    try {
      const users = reactions[emoji] || [];
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: users.includes(myUid) ? arrayRemove(myUid) : arrayUnion(myUid),
      });
    } catch {
      toast.error("Failed to update reaction");
    }
  };

  // Copy message text
  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || "").then(() => {
      toast.success("Message copied!");
      onClose?.();
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Message Preview */}
        <div
          style={{
            fontSize: 14,
            color: isDark ? "#eee" : "#111",
            wordBreak: "break-word",
          }}
        >
          {message.text || "Media message"}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionButton
            label="Reply"
            isDark={isDark}
            onClick={() => {
              setReplyTo?.(message);
              onClose();
            }}
          />
          <ActionButton
            label="Pin"
            isDark={isDark}
            onClick={() => {
              setPinnedMessage?.(message);
              onClose();
            }}
          />
          <ActionButton label="Copy" isDark={isDark} onClick={handleCopy} />
        </div>

        {/* Emoji Reactions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginTop: 8,
            justifyContent: "flex-start",
          }}
        >
          {QUICK_EMOJIS.map((emoji) => {
            const selected = reactions[emoji]?.includes(myUid);
            return (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                style={{
                  padding: 10,
                  fontSize: 18,
                  borderRadius: 12,
                  border: "1px solid",
                  borderColor: selected ? "#4a90e2" : isDark ? "#555" : "#ccc",
                  background: selected ? "#4a90e2" : isDark ? "#2a2a2a" : "#f5f5f5",
                  color: selected ? "#fff" : isDark ? "#eee" : "#111",
                  cursor: "pointer",
                  flex: "1 1 20%",
                  textAlign: "center",
                  minWidth: 50,
                }}
              >
                {emoji} {reactions[emoji]?.length || ""}
              </button>
            );
          })}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: isDark ? "#333" : "#ddd",
            color: isDark ? "#fff" : "#111",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Helper for consistent action buttons
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