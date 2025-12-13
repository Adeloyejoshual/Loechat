import React, { useState, useEffect, useRef } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { toast } from "react-toastify";
import EmojiPicker from "../Chat/EmojiPicker";

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
  const [reactions, setReactions] = useState(localReactions || {});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => setReactions(localReactions || {}), [localReactions]);

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

  const toggleReaction = async (emoji) => {
    const msgRef = doc(db, "chats", message.chatId, "messages", message.id);
    setReactions((prev) => {
      const next = { ...prev };
      const users = next[emoji] || [];
      if (users.includes(myUid)) {
        const filtered = users.filter((u) => u !== myUid);
        filtered.length ? (next[emoji] = filtered) : delete next[emoji];
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

  const handleCopy = () => {
    try {
      // fallback method: use a temporary input element
      const tempInput = document.createElement("textarea");
      tempInput.value = message.text || "[Media]";
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      toast.success("Message copied!");
      onClose?.();
    } catch {
      toast.error("Failed to copy message");
    }
  };

  const handleEmojiSelect = (emoji) => {
    toggleReaction(emoji);
    setShowEmojiPicker(false);
  };

  const handlePin = () => {
    setPinnedMessage?.(message);
    onClose();
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
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
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
          <ActionButton label="Pin" isDark={isDark} onClick={handlePin} />
          <ActionButton label="Copy" isDark={isDark} onClick={handleCopy} />
        </div>

        {/* Quick Emoji Reactions + + button */}
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
          <button
            onClick={() => setShowEmojiPicker(true)}
            style={{
              padding: 10,
              fontSize: 18,
              borderRadius: 12,
              border: "1px solid",
              borderColor: isDark ? "#555" : "#ccc",
              background: isDark ? "#2a2a2a" : "#f5f5f5",
              color: isDark ? "#eee" : "#111",
              cursor: "pointer",
              flex: "1 1 20%",
              textAlign: "center",
              minWidth: 50,
            }}
          >
            +
          </button>
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

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          open={true}
          isDark={isDark}
          onClose={() => setShowEmojiPicker(false)}
          onSelect={handleEmojiSelect}
          maxHeightPct={0.6}
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