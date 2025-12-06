// src/components/Chat/ChatInput.jsx
import React, { useState, useRef, useEffect } from "react";
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
  sendTextMessage,  // from ChatConversationPage
  sendMediaMessage, // from ChatConversationPage
  setShowPreview,
  disabled,
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // -----------------------------
  // FILE SELECTION
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const mediaFiles = files.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );

    if (!mediaFiles.length) return;

    setSelectedFiles((prev) => [...prev, ...mediaFiles].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  const handleCancelPreview = () => { setSelectedFiles([]); setShowPreview(false); };
  const handleAddMoreFiles = () => fileInputRef.current.click();

  // -----------------------------
  // MAIN SEND HANDLER
  // -----------------------------
  const handleSend = () => {
    if (disabled) return;
    if (selectedFiles.length > 0) sendMediaMessage(selectedFiles);
    else if (text.trim()) sendTextMessage();
  };

  // -----------------------------
  // ENTER = NEW LINE, SHIFT+ENTER = NEW LINE
  // -----------------------------
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const cursorPos = e.target.selectionStart;
      const newText = text.slice(0, cursorPos) + "\n" + text.slice(cursorPos);
      setText(newText);

      // Move cursor after newline
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = cursorPos + 1;
      }, 0);
    }
  };

  return (
    <>
      {/* REPLY PREVIEW */}
      {replyTo && (
        <div
          style={{
            background: isDark ? "#333" : "#eee",
            padding: 8,
            borderRadius: 10,
            margin: "6px 10px 0 10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 12,
              opacity: 0.8,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "85%",
            }}
          >
            Replying to:{" "}
            {replyTo.text
              ? replyTo.text.slice(0, 50)
              : replyTo.mediaType
              ? replyTo.mediaType.toUpperCase()
              : "Media"}
          </div>

          <button onClick={() => setReplyTo(null)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          padding: 10,
          gap: 10,
          borderTop: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.1)"}`,
          background: isDark ? "#1b1b1b" : "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 25,
        }}
      >
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*"
        />

        <button onClick={() => fileInputRef.current.click()} style={{ background: "transparent", border: "none" }}>
          <Paperclip size={22} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          onKeyDown={handleKeyDown}
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
          }}
        />

        <button onClick={handleSend} style={{ background: "transparent", border: "none" }} disabled={disabled}>
          <Send size={22} />
        </button>
      </div>

      {/* MEDIA PREVIEW */}
      {selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={() => sendMediaMessage(selectedFiles)}
          onAddFiles={handleAddMoreFiles}
          isDark={isDark}
        />
      )}
    </>
  );
}