// src/components/Chat/ChatInput.jsx
import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Send, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";

export default function ChatInput({
  text,
  setText,
  sendTextMessage,
  selectedFiles,
  setSelectedFiles,
  isDark,
  chatId,
  replyTo,
  setReplyTo,
  addMessages, // function to immediately add message to chat
  uploadFiles, // async function to upload files & return message object
}) {
  const fileInputRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // -----------------------------
  // File Selection
  // -----------------------------
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const mediaFiles = files.filter((f) =>
      f.type.startsWith("image/") || f.type.startsWith("video/") || f.type.startsWith("audio/")
    );

    if (!mediaFiles.length) return;

    setSelectedFiles((prev) => [...prev, ...mediaFiles].slice(0, 30));
    setShowPreview(true);
    e.target.value = null;
  };

  const handleRemoveFile = (index) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));

    if (fileToRemove && fileToRemove.url) URL.revokeObjectURL(fileToRemove.url);
  };

  const handleCancelPreview = () => {
    selectedFiles.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    setSelectedFiles([]);
    setShowPreview(false);
  };

  const handleAddMoreFiles = () => fileInputRef.current.click();

  // -----------------------------
  // Send text message
  // -----------------------------
  const handleSendText = () => {
    if (text.trim() === "" && selectedFiles.length === 0) return;

    if (text.trim() !== "") {
      sendTextMessage(); // existing function
      setText("");
      setReplyTo(null);
    }
  };

  // -----------------------------
  // Send files
  // -----------------------------
  const handleSendFiles = async (filesToSend) => {
    if (!filesToSend.length) return;

    // Convert files to messages with sending state
    const tempMessages = filesToSend.map((f) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      file: f.file,
      url: f.url,
      type: f.file.type.startsWith("video/") ? "video" : "image",
      status: "sending", // temp sending flag
      createdAt: new Date(),
      chatId,
    }));

    // Add temp messages to chat immediately
    addMessages(tempMessages);

    // Close modal
    setShowPreview(false);
    setSelectedFiles([]);

    // Upload files async and update message when done
    tempMessages.forEach(async (msg, idx) => {
      try {
        const uploadedMsg = await uploadFiles(msg.file, chatId, replyTo);
        // Replace temp message with uploaded message
        addMessages([uploadedMsg], msg.id); // second param = replace temp message
      } catch (err) {
        console.error("Upload failed", err);
        // Update status to failed
        addMessages([{ ...msg, status: "failed" }], msg.id);
      }
    });

    setReplyTo(null);
  };

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    };
  }, [selectedFiles]);

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
        {/* Hidden File Input */}
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
              handleSendText();
            }
          }}
        />

        <button
          onClick={handleSendText}
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}
        >
          <Send size={22} />
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && selectedFiles.length > 0 && (
        <ImagePreviewModal
          previews={selectedFiles.map((file) => ({
            file,
            url: URL.createObjectURL(file),
          }))}
          currentIndex={0}
          onRemove={handleRemoveFile}
          onClose={handleCancelPreview}
          onSend={() =>
            handleSendFiles(
              selectedFiles.map((f) => ({
                file: f,
                url: URL.createObjectURL(f),
              }))
            )
          }
          isDark={isDark}
        />
      )}
    </>
  );
}