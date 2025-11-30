// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  sendMediaMessage, // pass this from ChatConversationPage
  selectedFiles,
  setSelectedFiles,
  isDark,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // -----------------------------
  // File selection (images/videos only for preview)
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Only keep images/videos
    const mediaFiles = files.filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!mediaFiles.length) return;

    setSelectedFiles([...selectedFiles, ...mediaFiles].slice(0, 30));
    setShowPreview(true);

    e.target.value = null; // reset input
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendFromPreview = async () => {
    if (!selectedFiles.length) return;

    try {
      await sendMediaMessage(selectedFiles);
      setSelectedFiles([]);
      setShowPreview(false);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed. Try again.");
    }
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
          accept="image/*,video/*"
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
          onSend={handleSendFromPreview}
          onCancel={handleCancelPreview}
          onAddFiles={handleAddMoreFiles}
          isDark={isDark}
        />
      )}
    </>
  );
}