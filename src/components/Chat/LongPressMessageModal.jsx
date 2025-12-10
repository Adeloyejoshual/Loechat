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
  message,
  onMediaClick,
  openFullEmojiPicker,
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
  isDark = false,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef(null);

  // Prevent modal from closing too early
  const safeClose = () => {
    setTimeout(() => {
      onClose?.();
    }, 120);
  };

  // Lock scroll + close on click outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleEsc = (e) => e.key === "Escape" && onClose?.();

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, []);

  const buttonStyle = {
    padding: 10,
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    width: "100%",
    background: isDark ? "#2a2a2a" : "#f7f7f7",
    color: isDark ? "#fff" : "#000",
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  // ACTION HANDLERS ------------------------

  const handleCopy = () => {
    onCopy?.(message);
    toast.success("Message copied");
    safeClose();
  };

  const handlePin = () => {
    onPin?.(message);
    toast.success("Message pinned");
    safeClose();
  };

  const handleReply = () => {
    onReply?.(message);
    safeClose();
  };

  const handleReaction = (emoji) => {
    onReaction?.(message, emoji); // ensure messageId & emoji are passed
    safeClose();
  };

  const handleDelete = async (opt) => {
    try {
      if (opt === "me") await onDeleteForMe?.(message);
      if (opt === "everyone") await onDeleteForEveryone?.(message);
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
        zIndex: 3000,
        background: "rgba(0,0,0,0.28)",
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
          background: isDark ? "#1b1b1b" : "#ffffff",
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
            style={{ fontSize: 22, background: "transparent", border: "none" }}
            onClick={() => {
              safeClose();
              openFullEmojiPicker?.(message);
            }}
          >
            ➕
          </button>
        </div>

        {/* MAIN ACTIONS */}
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

            <button style={buttonStyle} onClick={onClose}>
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
                Delete for Me
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
                Delete for Everyone
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