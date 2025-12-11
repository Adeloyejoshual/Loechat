import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

export default function LongPressMessageModal({
  message,
  onClose,
  onCopy,
  onReply,
  onReaction,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  onMediaClick,
  openFullEmojiPicker,
  isDark = false,
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
}) {
  const modalRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!message) return null; // ← prevents BLANK PAGE crash

  // Smooth safe close to avoid blank UI
  const safeClose = () => {
    setTimeout(() => {
      if (typeof onClose === "function") onClose();
    }, 150);
  };

  // Close on ESC + outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (!modalRef.current) return;
      if (!modalRef.current.contains(e.target)) safeClose();
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") safeClose();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, []);

  // Button styling
  const btn = {
    padding: "10px",
    width: "100%",
    borderRadius: 8,
    fontSize: 15,
    border: "none",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    background: isDark ? "#292929" : "#f3f3f3",
    color: isDark ? "#fff" : "#000",
  };

  // Actions
  const handleCopy = () => {
    if (onCopy) onCopy(message);
    toast.success("Copied");
    safeClose();
  };

  const handleReply = () => {
    if (onReply) onReply(message);
    safeClose();
  };

  const handleReaction = (emoji) => {
    if (onReaction) onReaction(message, emoji);
    safeClose();
  };

  const handlePin = () => {
    if (onPin) onPin(message);
    toast.success("Pinned");
    safeClose();
  };

  const handleDelete = async (type) => {
    try {
      if (type === "me" && onDeleteForMe) await onDeleteForMe(message);
      if (type === "everyone" && onDeleteForEveryone) await onDeleteForEveryone(message);
    } catch {
      toast.error("Delete failed");
    }
    safeClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 15px 25px",
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: 380,
          background: isDark ? "#1a1a1a" : "#fff",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* quick reactions */}
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
              }}
            >
              {emoji}
            </button>
          ))}

          <button
            style={{
              background: "transparent",
              border: "none",
              fontSize: 22,
            }}
            onClick={() => {
              safeClose();
              if (openFullEmojiPicker) openFullEmojiPicker(message);
            }}
          >
            ➕
          </button>
        </div>

        {/* main options */}
        {!confirmDelete && (
          <>
            <button style={btn} onClick={handleReply}>↩️ Reply</button>
            <button style={btn} onClick={handleCopy}>📋 Copy</button>
            <button style={btn} onClick={handlePin}>📌 Pin</button>

            {message?.mediaUrls?.length > 0 && (
              <button
                style={btn}
                onClick={() => {
                  if (onMediaClick) onMediaClick(message, 0);
                  safeClose();
                }}
              >
                🖼️ View Media
              </button>
            )}

            <button
              style={{ ...btn, color: "red" }}
              onClick={() => setConfirmDelete(true)}
            >
              🗑️ Delete
            </button>

            <button style={btn} onClick={safeClose}>
              Close
            </button>
          </>
        )}

        {/* delete confirmation */}
        {confirmDelete && (
          <>
            <div style={{ textAlign: "center", fontSize: 16 }}>
              Delete this message?
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{ ...btn, flex: 1, background: "#ddd" }}
                onClick={() => handleDelete("me")}
              >
                Delete for me
              </button>

              <button
                style={{
                  ...btn,
                  flex: 1,
                  background: "red",
                  color: "#fff",
                }}
                onClick={() => handleDelete("everyone")}
              >
                Delete for everyone
              </button>
            </div>

            <button style={btn} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}