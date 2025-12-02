import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import axios from "axios";

export default function ImagePreviewModal({ files, onRemove, onCancel, onAddFiles, chatId, replyTo = null }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [textMap, setTextMap] = useState({}); // captions per file
  const [uploading, setUploading] = useState(false);
  const [progressMap, setProgressMap] = useState({});
  const [skippedFiles, setSkippedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  // Generate preview URLs once
  useEffect(() => {
    const urls = files.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(urls);

    return () => {
      urls.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [files]);

  const activeFile = previews[activeIndex]?.file;
  if (!activeFile) return null;

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

  const handleSend = async () => {
    if (!files.length) return;
    setUploading(true);
    setSkippedFiles([]);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip unsupported files
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          setSkippedFiles((prev) => [...prev, file.name]);
          continue;
        }

        let mediaUrl = "";
        const mediaType = file.type.startsWith("image/") ? "image" : "video";

        try {
          mediaUrl = await uploadToCloudinary(file, i);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          continue;
        }

        const payload = {
          senderId: auth.currentUser.uid,
          text: textMap[i] || "",
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

      if (skippedFiles.length > 0) {
        alert(`Skipped unsupported files: ${skippedFiles.join(", ")}`);
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", zIndex: 9999, padding: 20, color: "#fff" }}>
      {/* Close */}
      <button onClick={onCancel} style={{ position: "absolute", top: 20, right: 20, background: "rgba(0,0,0,0.4)", borderRadius: "50%", border: "none", width: 40, height: 40, display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
        <X color="#fff" size={22} />
      </button>

      {/* Active Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", maxHeight: "70vh", width: "100%" }}>
        {activeFile.type.startsWith("image/") && <img src={previews[activeIndex].url} alt="preview" style={{ maxWidth: "90%", maxHeight: "60%", borderRadius: 12, objectFit: "contain" }} />}
        {activeFile.type.startsWith("video/") && <video src={previews[activeIndex].url} controls style={{ maxWidth: "90%", maxHeight: "60%", borderRadius: 12 }} />}

        {/* Caption */}
        <input
          type="text"
          placeholder="Write a message..."
          value={textMap[activeIndex] || ""}
          onChange={(e) => setTextMap((prev) => ({ ...prev, [activeIndex]: e.target.value }))}
          style={{ marginTop: 10, width: "80%", padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", outline: "none", fontSize: 16 }}
        />
      </div>

      {/* Thumbnails */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 10, marginTop: 10 }}>
        <div onClick={onAddFiles} style={{ width: 80, height: 80, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 32, fontWeight: "bold", color: "#fff", cursor: "pointer", flexShrink: 0 }}>+</div>

        {previews.map((p, i) => (
          <div key={i} onClick={() => setActiveIndex(i)} style={{ position: "relative", width: 80, height: 80, borderRadius: 10, cursor: "pointer", border: activeIndex === i ? "2px solid #34B7F1" : "2px solid transparent", overflow: "hidden", background: "rgba(255,255,255,0.1)", flexShrink: 0 }}>
            {(p.file.type.startsWith("image/") || p.file.type.startsWith("video/")) && <img src={p.url} alt="thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 24, height: 24, display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}>
              <X size={16} color="#fff" />
            </button>

            {uploading && progressMap[i] != null && <div style={{ position: "absolute", bottom: 0, left: 0, width: `${progressMap[i]}%`, height: 4, background: "#34B7F1" }} />}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 15, justifyContent: "center", marginTop: 20 }}>
        <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#666", color: "#fff", fontWeight: "bold" }}>Cancel</button>
        <button onClick={handleSend} disabled={uploading} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#34B7F1", color: "#fff", fontWeight: "bold", cursor: uploading ? "not-allowed" : "pointer" }}>
          {uploading ? "Sending..." : `Send (${files.length})`}
        </button>
      </div>
    </div>
  );
}