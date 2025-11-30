// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  selectedFiles,
  setSelectedFiles,
  isDark,
  chatId,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // -----------------------------
  // File selection (images/videos/audio)
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Only keep images/videos/audio
    const mediaFiles = files.filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("video/") ||
        f.type.startsWith("audio/")
    );
    if (!mediaFiles.length) return;

    setSelectedFiles([...selectedFiles, ...mediaFiles].slice(0, 30));
    setShowPreview(true);

    e.target.value = null; // reset input
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  return (
    <>
      {/* Input bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 8,
          gap: 8,
          borderTop: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.06)"}`,
          background: isDark ? "#1b1b1b" : "#fff",
          position: "sticky",
          bottom: 0,
          zIndex: 20,
        }}
      >
        {/* File input */}
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*"
        />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Paperclip />
        </button>

        {/* Text input */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 12,
            border: `1px solid ${isDark ? "#333" : "rgba(0,0,0,0.06)"}`,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
        />

        {/* Send button */}
        <button
          onClick={sendTextMessage}
          style={{ fontSize: 18, background: "transparent", border: "none" }}
        >
          <Send />
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          files={selectedFiles}
          onRemove={handleRemoveFile}
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles}
          chatId={chatId} // pass chatId to modal for Firestore send
        />
      )}
    </>
  );
}