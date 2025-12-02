// src/components/ImagePreviewModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import axios from "axios";

export default function ImagePreviewModal({ files, onRemove, onCancel, onAddFiles, chatId, replyTo = null }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [text, setText] = useState(""); // single caption for all
  const [uploading, setUploading] = useState(false);
  const [progressMap, setProgressMap] = useState({}); // per-file upload progress

  const activeFile = files[activeIndex];
  if (!activeFile) return null;

  // ------------------- Upload to Cloudinary -------------------
  const uploadToCloudinary = async (file, index) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

    const res = await axios.post(
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/auto/upload`,
      formData,
      {
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded * 100) / e.total);
          setProgressMap((prev) => ({ ...prev, [index]: percent }));
        },
      }
    );

    return res.data.secure_url;
  };

  // ------------------- Send Files -------------------
  const handleSend = async () => {
    if (!files.length) return;
    setUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        // Skip unsupported files
        if (!isImage && !isVideo) {
          alert(`${file.name} is not supported. Only images and videos can be sent.`);
          continue;
        }

        const mediaUrl = await uploadToCloudinary(file, i);
        const mediaType = isImage ? "image" : "video";

        const payload = {
          senderId: auth.currentUser.uid,
          text: text || "",
          mediaUrl,
          mediaType,
          reactions: {},
          createdAt: serverTimestamp(),
          seenBy: [],
          status: "sent",
        };

        if (replyTo) {
          payload.replyTo = {
            id: replyTo.id,
            text: replyTo.text,
            senderId: replyTo.senderId,
          };
        }

        await addDoc(collection(db, "chats", chatId, "messages"), payload);
      }

      onCancel();
    } catch (err) {
      console.error("Failed to send files:", err);
      alert("Failed to send files. Check console for details.");
    } finally {
      setUploading(false);
      setProgressMap({});
    }
  };

  // ------------------- Render -------------------
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", zIndex: 9999, padding: 20, color: "#fff" }}>
      
      {/* Close Button */}
      <button
        onClick={onCancel}
        style={{ position: "absolute", top: 20, right: 20, background: "rgba(0,0,0,0.4)", borderRadius: "50%", border: "none", width: 40, height: 40, display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}
      >
        <X color="#fff" size={22} />
      </button>

      {/* Active Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", maxHeight: "70vh", width: "100%" }}>
        {activeFile.type.startsWith("image/") && (
          <img src={URL.createObjectURL(activeFile)} alt="preview" style={{ maxWidth: "90%", maxHeight: "60%", borderRadius: 12, objectFit: "contain" }} />
        )}
        {activeFile.type.startsWith("video/") && (
          <video src={URL.createObjectURL(activeFile)} controls style={{ maxWidth: "90%", maxHeight: "60%", borderRadius: 12 }} />
        )}

        {/* Caption Input */}
        <input
          type="text"
          placeholder="Write a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ marginTop: 10, width: "80%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", outline: "none", fontSize: 16 }}
        />
      </div>

      {/* Thumbnails */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, marginTop: 10 }}>
        {/* Add More Files */}
        <div
          onClick={onAddFiles}
          style={{ width: 80, height: 80, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 32, fontWeight: "bold", color: "#fff", cursor: "pointer", flexShrink: 0 }}
        >
          +
        </div>

        {/* File Thumbnails */}
        {files.map((f, i) => (
          <div
            key={i}
            onClick={() => setActiveIndex(i)}
            style={{ position: "relative", width: 80, height: 80, borderRadius: 10, cursor: "pointer", border: activeIndex === i ? "2px solid #34B7F1" : "2px solid transparent", overflow: "hidden", background: "rgba(255,255,255,0.1)", flexShrink: 0 }}
          >
            {(f.type.startsWith("image/") || f.type.startsWith("video/")) && (
              <img src={URL.createObjectURL(f)} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )}

            {/* Remove Button */}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(i); }}
              style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}
            >
              <X size={16} color="#fff" />
            </button>

            {/* Upload Progress */}
            {uploading && progressMap[i] != null && (
              <div style={{ position: "absolute", bottom: 0, left: 0, width: `${progressMap[i]}%`, height: 4, background: "#34B7F1" }} />
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 15, justifyContent: "center", marginTop: 20 }}>
        <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#666", color: "#fff", fontWeight: "bold" }}>Cancel</button>
        <button onClick={handleSend} disabled={uploading} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#34B7F1", color: "#fff", fontWeight: "bold", cursor: uploading ? "not-allowed" : "pointer" }}>
          {uploading ? "Sending..." : `Send (${files.length})`}
        </button>
      </div>
    </div>
  );
}