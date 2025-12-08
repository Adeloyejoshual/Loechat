import React, { useState, useEffect, useRef } from "react";
import EmojiPicker from "./EmojiPicker";
import { toast } from "react-toastify";

export default function LongPressMessageModal({
  onClose,
  onReaction,
  onReply,
  onCopy,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
  isDark = false,
  messageSenderName = "you",
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef(null);

  // Close modal on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden"; // lock scroll
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = ""; // unlock scroll
    };
  }, [onClose]);

  const buttonBaseStyle = {
    padding: 10,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    fontSize: 14,
    textAlign: "left",
    borderRadius: 8,
    width: "100%",
    transition: "background 0.2s, transform 0.15s",
  };

  const actionButtonStyle = {
    ...buttonBaseStyle,
    background: isDark ? "#2a2a2a" : "#f7f7f7",
    color: isDark ? "#fff" : "#000",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const safeClose = (delay = 50) => setTimeout(onClose, delay);

  const handlePin = () => {
    onPin();
    toast.success("Message pinned/unpinned");
    safeClose();
  };

  const handleCopy = () => {
    onCopy();
    toast.success("Message copied");
    safeClose();
  };

  const handleReaction = (emoji) => {
    onReaction(emoji);
    safeClose();
  };

  const handleDelete = async (option) => {
    if (option === "me" && onDeleteForMe) await onDeleteForMe();
    if (option === "everyone" && onDeleteForEveryone) await onDeleteForEveryone();
    safeClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 12px 24px",
        backgroundColor: "rgba(0,0,0,0.25)",
        animation: "fadeIn 180ms ease",
      }}
    >
      <div
        ref={modalRef}
        style={{
          background: isDark ? "#1b1b1b" : "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 360,
          padding: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          animation: "slideUp 180ms ease",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {!confirmDelete ? (
          <>
            {/* Quick Reactions */}
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                position: "sticky",
                top: 0,
                background: isDark ? "#1b1b1b" : "#fff",
                zIndex: 10,
                paddingBottom: 8,
              }}
            >
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  style={{
                    fontSize: 22,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    transition: "transform 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.25)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {emoji}
                </button>
              ))}

              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                style={{
                  fontSize: 22,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "transform 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                ➕
              </button>
            </div>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => {
                  onReaction(emoji);
                  setShowEmojiPicker(false);
                  safeClose();
                }}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={actionButtonStyle} onClick={() => { onReply(); safeClose(); }}>
                ↩️ Reply
              </button>
              <button style={actionButtonStyle} onClick={handleCopy}>
                📋 Copy
              </button>
              <button style={actionButtonStyle} onClick={handlePin}>
                📌 Pin
              </button>
              <button
                style={{ ...actionButtonStyle, color: "red" }}
                onClick={() => setConfirmDelete(true)}
              >
                🗑️ Delete
              </button>
              <button style={actionButtonStyle} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          // Confirm delete options
          <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
            <div style={{ fontSize: 14 }}>Delete this message?</div>
            <div style={{ fontSize: 12, color: "#888" }}>For {messageSenderName}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <button
                onClick={() => handleDelete("me")}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  flex: 1,
                  marginRight: 4,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#eee")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Delete for Me
              </button>
              <button
                onClick={() => handleDelete("everyone")}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: "red",
                  color: "#fff",
                  cursor: "pointer",
                  flex: 1,
                  marginLeft: 4,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#c40000")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "red")}
              >
                Delete for Everyone
              </button>
            </div>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #ccc",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#eee")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}