// src/components/Chat/ChatInput.jsx
import React, { useState, useRef } from "react";
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
  addMessages,
  uploadFiles,
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // -----------------------------
  // File selection (images/videos)
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

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelPreview = () => {
    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  // -----------------------------
  // Send text + media
  // -----------------------------
  const handleSendFiles = async () => {
    if (!selectedFiles.length && !text.trim()) return;

    const tempMessages = selectedFiles.map((file) => ({
      id: `temp-${Date.now()}-${file.name}`,
      mediaUrl: URL.createObjectURL(file),
      mediaType: file.type.startsWith("video/") ? "video" : "image",
      text: "",
      createdAt: new Date(),
      senderId: "me",
      status: "uploading",
      replyTo: replyTo ? replyTo.id : null,
    }));

    // Add temp messages immediately
    addMessages(tempMessages);

    // Close preview
    setSelectedFiles([]);
    setShowPreview(false);
    setText("");

    // Upload files in background
    for (const file of selectedFiles) {
      try {
        const uploaded = await uploadFiles(file, replyTo ? replyTo.chatId : null, replyTo);
        // Replace temp message with uploaded message
        addMessages([uploaded], tempMessages.find((m) => m.id.includes(file.name)).id);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }

    // Clear reply after sending
    setReplyTo(null);
  };

  // -----------------------------
  // Send text message only
  // -----------------------------
  const handleSendText = async () => {
    if (!text.trim()) return;

    const tempMessage = {
      id: `temp-text-${Date.now()}`,
      text: text.trim(),
      createdAt: new Date(),
      senderId: "me",
      status: "sending",
      replyTo: replyTo ? replyTo.id : null,
    };

    addMessages([tempMessage]);
    setText("");
    setReplyTo(null);

    // Optionally, you can upload text message to Firestore here
  };

  const handleSend = () => {
    if (selectedFiles.length > 0) handleSendFiles();
    else handleSendText();
  };

  return (
    <>
      {/* Reply Preview */}
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

          <button
            onClick={() => setReplyTo(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
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

        <button
          onClick={() => fileInputRef.current.click()}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
        >
          <Paperclip size={22} />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 14,
            border: `1px solid ${isDark ? "#333" : "#ddd"}`,
            outline: "none",
            background: isDark ? "#0b0b0b" : "#fff",
            color: isDark ? "#fff" : "#000",
            fontSize: 15,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <button
          onClick={handleSend}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
        >
          <Send size={22} />
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((file) => ({ file, url: URL.createObjectURL(file) }))}
          currentIndex={0}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={handleSendFiles}
          onAddFiles={handleAddMoreFiles}
          isDark={isDark}
        />
      )}
    </>
  );
}