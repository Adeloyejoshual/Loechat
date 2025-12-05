// src/components/Chat/ChatInput.jsx
import React, { useState, useRef, useEffect } from "react";
import { Paperclip, Send, X } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";
import { addDoc, collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";

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
  chatId,
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);
  const typingTimeout = useRef(null);
  const myUid = auth.currentUser?.uid;

  // -----------------------------
  // ✅ FILE SELECTION
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
  // ✅ TYPING INDICATOR (LIVE)
  // -----------------------------
  const handleTyping = async (value) => {
    setText(value);

    if (!chatId || !myUid) return;

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      [`typing.${myUid}`]: true,
    });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(async () => {
      await updateDoc(chatRef, {
        [`typing.${myUid}`]: false,
      });
    }, 1200);
  };

  // -----------------------------
  // ✅ SEND TEXT (SAVED TO FIRESTORE)
  // -----------------------------
  const handleSendText = async () => {
    if (!text.trim()) return;

    const tempId = `temp-text-${Date.now()}`;

    const tempMessage = {
      id: tempId,
      text: text.trim(),
      createdAt: new Date(),
      senderId: myUid,
      status: "sending",
      replyTo: replyTo ? replyTo.id : null,
    };

    addMessages([tempMessage]);
    setText("");
    setReplyTo(null);

    try {
      const docRef = await addDoc(collection(db, "chats", chatId, "messages"), {
        text: tempMessage.text,
        createdAt: serverTimestamp(),
        senderId: myUid,
        status: "sent",
        replyTo: replyTo ? replyTo.id : null,
        seenBy: [myUid],
      });

      addMessages([{ ...tempMessage, id: docRef.id, status: "sent" }], tempId);
    } catch (err) {
      console.error("Text send failed:", err);
    }
  };

  // -----------------------------
  // ✅ SEND FILES
  // -----------------------------
  const handleSendFiles = async () => {
    if (!selectedFiles.length) return;

    setSelectedFiles([]);
    setShowPreview(false);
    setText("");
    setReplyTo(null);

    for (const file of selectedFiles) {
      try {
        await uploadFiles(file, replyTo);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
  };

  // -----------------------------
  // ✅ MAIN SEND HANDLER
  // -----------------------------
  const handleSend = () => {
    if (selectedFiles.length > 0) handleSendFiles();
    else handleSendText();
  };

  // ✅ ENTER = SEND | SHIFT + ENTER = NEW LINE
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // -----------------------------
  // ✅ CLEAR TYPING ON UNMOUNT
  // -----------------------------
  useEffect(() => {
    return async () => {
      if (!chatId || !myUid) return;
      await updateDoc(doc(db, "chats", chatId), {
        [`typing.${myUid}`]: false,
      });
    };
  }, [chatId, myUid]);

  return (
    <>
      {/* ✅ REPLY PREVIEW */}
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

      {/* ✅ INPUT BAR */}
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
          onChange={(e) => handleTyping(e.target.value)}
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
          }}
        />

        <button onClick={handleSend} style={{ background: "transparent", border: "none" }}>
          <Send size={22} />
        </button>
      </div>

      {/* ✅ MEDIA PREVIEW */}
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