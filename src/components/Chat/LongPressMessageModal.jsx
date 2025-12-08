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
  quickReactions = ["😜", "💗", "😎", "😍", "☻️", "💖"],
  isDark = false,
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const modalRef = useRef(null);

  // Close modal on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden"; // lock scroll
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = ""; // unlock scroll
    };
  }, [onClose]);

  const buttonStyle = {
    padding: 10,
    cursor: "pointer",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    textAlign: "left",
    width: "100%",
    transition: "background 0.2s, transform 0.15s",
    background: isDark ? "#2a2a2a" : "#f7f7f7",
    color: isDark ? "#fff" : "#000",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const safeClose = (delay = 50) => setTimeout(onClose, delay);

  const handlePin = () => { onPin(); toast.success("Message pinned/unpinned"); safeClose(); };
  const handleCopy = () => { onCopy(); toast.success("Message copied"); safeClose(); };
  const handleReaction = (emoji) => { onReaction(emoji); setShowEmojiPicker(false); };
  const handleDelete = async (option) => {
    try {
      if (option === "me" && onDeleteForMe) await onDeleteForMe();
      if (option === "everyone" && onDeleteForEveryone) await onDeleteForEveryone();
    } catch {
      toast.error("Failed to delete message");
    } finally { safeClose(); }
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
        {!showEmojiPicker ? (
          !confirmDelete ? (
            <>
              {/* Quick Reactions */}
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
                {quickReactions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    style={{ fontSize: 22, background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowEmojiPicker(true)}
                  style={{ fontSize: 22, background: "transparent", border: "none", cursor: "pointer" }}
                >
                  ➕
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button style={buttonStyle} onClick={() => { onReply(); safeClose(); }}>↩️ Reply</button>
                <button style={buttonStyle} onClick={handleCopy}>📋 Copy</button>
                <button style={buttonStyle} onClick={handlePin}>📌 Pin</button>
                {message?.mediaUrls?.length > 0 && (
                  <button style={buttonStyle} onClick={() => { onMediaClick(message, 0); safeClose(); }}>🖼️ View Media</button>
                )}
                <button style={{ ...buttonStyle, color: "red" }} onClick={() => setConfirmDelete(true)}>🗑️ Delete</button>
                <button style={buttonStyle} onClick={onClose}>Close</button>
              </div>
            </>
          ) : (
            // Confirm delete
            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "center" }}>
              <div style={{ fontSize: 14 }}>Delete this message?</div>
              <div style={{ fontSize: 12, color: "#888" }}>For you</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <button onClick={() => handleDelete("me")} style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc", cursor: "pointer", flex: 1, marginRight: 4 }}>
                  Delete for Me
                </button>
                <button onClick={() => handleDelete("everyone")} style={{ padding: 10, borderRadius: 8, backgroundColor: "red", color: "#fff", cursor: "pointer", flex: 1, marginLeft: 4 }}>
                  Delete for Everyone
                </button>
              </div>
              <button onClick={() => setConfirmDelete(false)} style={{ marginTop: 8, padding: 8, borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>Cancel</button>
            </div>
          )
        ) : (
          <EmojiPicker
            onSelect={(emoji) => handleReaction(emoji)}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </div>

      <style>{`
        @keyframes slideUp {0% {opacity:0;transform:translateY(24px);}100% {opacity:1;transform:translateY(0);}}
        @keyframes fadeIn {0% {opacity:0;}100% {opacity:1;}}
      `}</style>
    </div>
  );
}