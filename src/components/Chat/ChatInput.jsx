// src/components/Chat/ChatInput.jsx
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
  const stopTypingTimeout = useRef(null);
  const [typingVisible, setTypingVisible] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    const maxHeight = 120;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  // Typing detection
  useEffect(() => {
    if (!setTyping) return;

    if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);

    if (text.length > 0) {
      setTyping(true);
      stopTypingTimeout.current = setTimeout(() => setTyping(false), 1500);
    } else {
      setTyping(false);
    }

    return () => clearTimeout(stopTypingTimeout.current);
  }, [text, setTyping]);

  // Friend typing indicator
  useEffect(() => {
    if (friendTyping) setTypingVisible(true);
    else setTypingVisible(false);
  }, [friendTyping]);

  const previews = useMemo(
    () => selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("image") ? "image" :
            file.type.startsWith("video") ? "video" :
            file.type.startsWith("audio") ? "audio" : "file",
      name: file.name,
    })),
    [selectedFiles]
  );

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const mediaFiles = files.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/") || f.type
    );
    if (!mediaFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...mediaFiles].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSend = async () => {
    if (disabled) return;
    try {
      if (selectedFiles.length > 0) {
        await sendMediaMessage(selectedFiles, replyTo || null, {}); // captions handled in modal
        setSelectedFiles([]);
        setShowPreview(false);
      }
      if (text.trim()) {
        await sendTextMessage(text.trim(), replyTo || null);
        setText("");
      }
      setReplyTo?.(null);
      setTyping?.(false);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <>
      {/* Input bar */}
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
          accept="image/*,video/*,audio/*"
        />
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
            maxHeight: 120,
          }}
        />

        <button onClick={handleSend} style={{ background: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer", padding: 6, borderRadius: 6 }}>
          <Send size={22} />
        </button>
      </div>

      {/* Media preview modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={previews}
          onClose={() => setShowPreview(false)}
          onRemove={handleRemoveFile}
          onSend={(files, captionsMap) => sendMediaMessage(files, replyTo, captionsMap)}
          isDark={isDark}
        />
      )}
    </>
  );
}