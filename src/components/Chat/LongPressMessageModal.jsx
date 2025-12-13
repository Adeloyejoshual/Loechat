import React, { useState } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export default function LongPressMessageModal({
  message,
  myUid,
  onClose,
  setReplyTo,
  setPinnedMessage,
  localReactions = {},
  isDark = false,
}) {
  const [reactions, setReactions] = useState(localReactions);

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
      toast.error("Reaction failed");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || "").then(() => {
      toast.success("Message copied!");
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(0,0,0,0.35)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 350,
          background: isDark ? "#1c1c1c" : "#fff",
          borderRadius: 16,
          padding: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Message preview */}
        <div style={{ fontSize: 14, color: isDark ? "#eee" : "#111", wordBreak: "break-word" }}>
          {message.text || "Media message"}
        </div>

        {/* Quick Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => {
              setReplyTo?.(message);
              onClose();
            }}
            style={buttonStyle(isDark)}
          >
            Reply
          </button>

          <button
            onClick={() => {
              setPinnedMessage?.(message);
              onClose();
            }}
            style={buttonStyle(isDark)}
          >
            Pin
          </button>

          <button onClick={handleCopy} style={buttonStyle(isDark)}>
            Copy
          </button>
        </div>

        {/* Reactions */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              style={{
                padding: 8,
                fontSize: 18,
                borderRadius: 12,
                border: "1px solid",
                borderColor: reactions[emoji]?.includes(myUid) ? "#4a90e2" : isDark ? "#555" : "#ccc",
                background: reactions[emoji]?.includes(myUid) ? "#4a90e2" : isDark ? "#2a2a2a" : "#f5f5f5",
                color: reactions[emoji]?.includes(myUid) ? "#fff" : isDark ? "#eee" : "#111",
                cursor: "pointer",
                flex: "1 1 20%",
                textAlign: "center",
              }}
            >
              {emoji} {reactions[emoji]?.length || ""}
            </button>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 12,
            background: isDark ? "#333" : "#ddd",
            color: isDark ? "#fff" : "#111",
            fontWeight: 600,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Button style helper
const buttonStyle = (isDark) => ({
  padding: 10,
  borderRadius: 12,
  border: "none",
  background: isDark ? "#333" : "#eee",
  color: isDark ? "#fff" : "#111",
  textAlign: "left",
  fontSize: 14,
  cursor: "pointer",
});