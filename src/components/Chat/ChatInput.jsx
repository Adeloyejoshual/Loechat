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

  // ---------------- Auto-resize textarea ----------------
  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = "auto";
    const maxHeight = 120;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  // ---------------- Typing detection ----------------
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

  // ---------------- Friend typing indicator ----------------
  useEffect(() => {
    setTypingVisible(friendTyping);
  }, [friendTyping]);

  // ---------------- File previews ----------------
  const previews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        previewUrl:
          file.type.startsWith("image/") || file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : null,
        type: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
          ? "audio"
          : "file",
        name: file.name,
      })),
    [selectedFiles]
  );

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSelectedFiles((prev) => [...prev, ...files].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) =>
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

  // ---------------- Send message ----------------
  const handleSend = async () => {
    if (disabled) return;

    try {
      if (selectedFiles.length > 0) {
        await sendMediaMessage(selectedFiles, replyTo || null);
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

  // ---------------- Typing dots component ----------------
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
      <div style={{ margin: "4px 10px 0", height: 18 }}>
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
      <TypingDots />

      {/* Reply preview */}
      {replyTo && (
        <div
          style={{
            background: isDark ? "#333" : "#eee",
            padding: 8,
            borderRadius: 10,
            margin: "6px 10px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <div
            style={{
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
          <button
            onClick={() => setReplyTo(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

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
          accept="image/*,video/*,audio/*,*/*"
        />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 6,
            borderRadius: 6,
          }}
        >
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

        <button
          onClick={handleSend}
          style={{
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: 6,
            borderRadius: 6,
          }}
        >
          <Send size={22} />
        </button>
      </div>

      {/* Media preview */}
      {selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={previews}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={(files, caption) => sendMediaMessage(files, replyTo || null, caption)}
          isDark={isDark}
        />
      )}
    </>
  );
}