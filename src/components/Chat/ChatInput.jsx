// src/components/Chat/ChatInput.jsx
import React, { useRef, useEffect } from "react";
import { Paperclip, Send, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

/**
 * ChatInput props:
 * - text, setText
 * - selectedFiles, setSelectedFiles
 * - isDark
 * - replyTo, setReplyTo
 * - sendTextMessage, sendMediaMessage
 * - setShowPreview
 * - disabled
 * - friendTyping (read-only)
 * - setTyping(typing: boolean) -> new callback provided by parent to report typing state
 */
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

  // file selection
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

  // send handler
  const handleSend = () => {
    if (disabled) return;
    if (selectedFiles.length > 0) {
      sendMediaMessage(selectedFiles);
    } else if (text.trim()) {
      sendTextMessage();
    }
    // user sent -> signal not typing
    setTyping?.(false);
  };

  // Typing detection: call setTyping(true) when user starts typing and false after idle
  useEffect(() => {
    // call parent typing setter when text changes
    if (!setTyping) return;
    const changed = text !== lastInput.current;
    if (!changed) return;
    lastInput.current = text;
    if (text.length > 0) {
      setTyping(true);
    } else {
      setTyping(false);
    }
    // Note: parent will debounce to set false after idle
  }, [text, setTyping]);

  // ENTER behavior: Enter sends, Shift+Enter newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Reply preview */}
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
          <div style={{ fontSize: 12, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>
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
        zIndex: 25,
      }}>
        <input type="file" multiple hidden ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" />
        <button onClick={() => fileInputRef.current.click()} style={{ background: "transparent", border: "none" }}>
          <Paperclip size={22} />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "You cannot send messages" : "Type a message..."}
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

      {/* Media preview (inline) */}
      {selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={() => sendMediaMessage(selectedFiles)}
          onAddFiles={() => fileInputRef.current.click()}
          isDark={isDark}
        />
      )}
    </>
  );
}