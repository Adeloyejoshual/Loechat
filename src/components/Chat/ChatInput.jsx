// src/components/ChatInput.jsx
import React, { useRef, useEffect, useMemo, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  selectedFiles,
  setSelectedFiles,
  isDark,
  replyTo,
  setReplyTo,
  sendTextMessage,
  sendMediaMessage,
  setShowPreview,
  disabled,
  friendTyping,
  setTyping,
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const lastInput = useRef("");

  const [typingVisible, setTypingVisible] = useState(false);
  const typingTimeout = useRef(null);

  const previews = useMemo(
    () => selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [selectedFiles]
  );

  // Auto-resize textarea with max height
  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    const maxHeight = 120; // ~6 lines
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  // File selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const mediaFiles = files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!mediaFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...mediaFiles].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  const handleCancelPreview = () => { setSelectedFiles([]); setShowPreview(false); };

  // Send handler
  const handleSend = () => {
    if (disabled) return;
    if (selectedFiles.length > 0) {
      sendMediaMessage(selectedFiles);
      setSelectedFiles([]);
    } else if (text.trim()) {
      sendTextMessage();
    }
    setReplyTo?.(null);
    setTyping?.(false);
    setText("");
  };

  // Typing detection for sending live status
  useEffect(() => {
    if (!setTyping) return;
    const changed = text !== lastInput.current;
    if (!changed) return;
    lastInput.current = text;
    setTyping(text.length > 0);
  }, [text, setTyping]);

  // Typing indicator dots with smooth fade
  useEffect(() => {
    if (friendTyping) {
      setTypingVisible(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    } else {
      typingTimeout.current = setTimeout(() => setTypingVisible(false), 400);
    }
    return () => clearTimeout(typingTimeout.current);
  }, [friendTyping]);

  const TypingDots = () => {
    if (!typingVisible) return null;
    const dotStyle = (delay) => ({
      width: 8,
      height: 8,
      margin: 2,
      borderRadius: "50%",
      backgroundColor: isDark ? "#fff" : "#333",
      display: "inline-block",
      animation: `bounce 1.2s infinite ${delay}s`,
    });
    return (
      <div style={{ margin: "4px 10px 0", height: 18, opacity: typingVisible ? 1 : 0, transition: "opacity 0.4s" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={dotStyle(0)}></span>
          <span style={dotStyle(0.2)}></span>
          <span style={dotStyle(0.4)}></span>
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  };

  return (
    <>
      {/* Typing indicator */}
      <TypingDots />

      {/* Reply preview */}
      {replyTo && (
        <div style={{
          background: isDark ? "#333" : "#eee",
          padding: 8,
          borderRadius: 10,
          margin: "6px 10px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12
        }}>
          <div style={{ opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>
            Replying to: {replyTo.text ? replyTo.text.slice(0, 50) : replyTo.mediaType ? replyTo.mediaType.toUpperCase() : "Media"}
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        padding: 10,
        gap: 10,
        borderTop: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.1)"}`,
        background: isDark ? "#1b1b1b" : "#fff",
        position: "sticky",
        bottom: 0,
        zIndex: 25
      }}>
        <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" />
        <button onClick={() => fileInputRef.current.click()} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 6 }}>
          <Paperclip size={22} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "You cannot send messages" : "Type a message..."}
          rows={1}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 14,
            border: `1px solid ${isDark ? "#333" : "#ddd"}`,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
            fontSize: 15,
            resize: "none",
            overflow: "hidden",
            lineHeight: 1.4,
            maxHeight: 120
          }}
        />

        <button onClick={handleSend} style={{ background: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer", padding: 6, borderRadius: 6 }}>
          <Send size={22} />
        </button>
      </div>

      {/* Media preview */}
      {selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={previews}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={(caption) => sendMediaMessage(selectedFiles, caption)}
          isDark={isDark}
        />
      )}
    </>
  );
}