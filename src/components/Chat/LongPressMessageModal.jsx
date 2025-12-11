import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";

export default function LongPressMessageModal({
  onClose,
  onReaction,
  onReply,
  onCopy,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  onMediaClick,
  openFullEmojiPicker,
  message = {},
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
  isDark = false,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef(null);

  /** SAFEST CLOSE FUNCTION */
  const safeClose = () => {
    setTimeout(() => {
      try {
        onClose?.();
      } catch {}
    }, 80);
  };

  /** Close on outside tap or esc */
  useEffect(() => {
    const handleOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        safeClose();
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") safeClose();
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const buttonStyle = {
    padding: 10,
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    width: "100%",
    background: isDark ? "#2a2a2a" : "#f1f1f1",
    color: isDark ? "#fff" : "#000",
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  // ===================== ACTIONS =====================

  const handleCopy = () => {
    const text = message?.text || "";
    navigator.clipboard.writeText(text);
    toast.success("Copied");
    safeClose();
  };

  const handleReply = () => {
    onReply?.(message);
    safeClose();
  };

  const handlePin = () => {
    onPin?.(message);
    toast.success("Pinned");
    safeClose();
  };

  const handleReaction = (emoji) => {
    onReaction?.(message, emoji);
    safeClose();
  };

  const handleDelete = async (type) => {
    try {
      if (type === "me") await onDeleteForMe?.(message);
      if (type === "everyone") await onDeleteForEveryone?.(message);
    } catch (e) {
      toast.error("Delete failed");
    }
    safeClose();
  };

  // ===================== UI =====================

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 5000,
        background: "rgba(0,0,0,0.32)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: "0 16px 28px",
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: 380,
          background: isDark ? "#1a1a1a" : "#fff",
          borderRadius: 18,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* QUICK REACTIONS */}
        <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
              }}
              onClick={() => handleReaction(emoji)}
            >
              {emoji}
            </button>
          ))}

          <button
            style={{
              fontSize: 22,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => {
              safeClose();
              openFullEmojiPicker?.(message);
            }}
          >
            ➕
          </button>
        </div>

        {/* MAIN OPTIONS */}
        {!confirmDelete ? (
          <>
            <button style={buttonStyle} onClick={handleReply}>↩️ Reply</button>
            <button style={buttonStyle} onClick={handleCopy}>📋 Copy</button>
            <button style={buttonStyle} onClick={handlePin}>📌 Pin</button>

            {message?.mediaUrls?.length > 0 && (
              <button
                style={buttonStyle}
                onClick={() => {
                  onMediaClick?.(message, 0);
                  safeClose();
                }}
              >
                🖼️ View Media
              </button>
            )}

            <button
              style={{ ...buttonStyle, color: "red" }}
              onClick={() => setConfirmDelete(true)}
            >
              🗑️ Delete
            </button>

            <button
              style={buttonStyle}
              onClick={safeClose}
            >
              Close
            </button>
          </>
        ) : (
          <>
            <div style={{ textAlign: "center", fontSize: 15 }}>
              Delete this message?
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                }}
                onClick={() => handleDelete("me")}
              >
                For Me
              </button>

              <button
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 8,
                  background: "red",
                  color: "white",
                }}
                onClick={() => handleDelete("everyone")}
              >
                For Everyone
              </button>
            </div>

            <button
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}