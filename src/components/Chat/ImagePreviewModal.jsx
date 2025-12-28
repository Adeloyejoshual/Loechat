// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";

export default function ImagePreviewModal({
  previews = [], // [{ file, previewUrl, type, name }]
  onRemove = () => {},
  onClose = () => {},
  onSend = async () => {}, // (files, captionsMap) => {}
  isDark = false,
  disabled = false,
}) {
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const [captions, setCaptions] = useState({}); // { fileName: caption }
  const [uploadProgress, setUploadProgress] = useState({}); // { fileName: percent }

  if (!previews.length) return null;
  const current = previews[index];

  // --- Navigation ---
  const handleNext = () => setIndex((i) => Math.min(i + 1, previews.length - 1));
  const handlePrev = () => setIndex((i) => Math.max(i - 1, 0));

  // --- Touch / drag support ---
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    startPos.current = { x: t.clientX, y: t.clientY };
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const t = e.touches[0];
    const dx = t.clientX - startPos.current.x;
    const dy = t.clientY - startPos.current.y;
    setTranslate({ x: dx, y: dy });
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    const { x, y } = translate;
    if (y > 120) return onClose(); // swipe down to close
    if (x < -80 && index < previews.length - 1) handleNext();
    else if (x > 80 && index > 0) handlePrev();
    setTranslate({ x: 0, y: 0 });
  };

  // --- Send handler with progress & error ---
  const handleSend = async () => {
    if (sending || disabled) return;
    setSending(true);
    try {
      await onSend(previews.map((p) => p.file), captions, setUploadProgress);
      setCaptions({});
      setUploadProgress({});
      onClose();
      toast.success("Files sent successfully!");
    } catch (err) {
      console.error("Send failed:", err);
      toast.error("Upload failed");
      setSending(false);
    }
  };

  // --- Click outside to close ---
  const modalRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  // --- Cleanup object URLs ---
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, [previews]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        padding: 12,
      }}
    >
      <div
        ref={modalRef}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: 500,
        }}
      >
        {/* --- Media Preview --- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: "100%",
            maxHeight: "60vh",
            transform: `translate(${translate.x}px, ${translate.y}px)`,
            transition: isDragging ? "none" : "transform 0.25s ease",
            touchAction: "none",
            flexDirection: "column",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {current.type === "image" && (
            <img
              src={current.previewUrl}
              alt={current.name}
              style={{ maxHeight: "60vh", maxWidth: "100%", borderRadius: 8 }}
              draggable={false}
            />
          )}
          {current.type === "video" && (
            <video
              src={current.previewUrl}
              controls
              style={{ maxHeight: "60vh", maxWidth: "100%", borderRadius: 8 }}
            />
          )}
          {current.type === "audio" && (
            <div style={{ textAlign: "center" }}>
              <audio controls src={current.previewUrl} />
              <div style={{ marginTop: 8, fontSize: 14 }}>{current.name}</div>
            </div>
          )}
          {current.type === "file" && (
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 40 }}>📄</span>
              <div style={{ marginTop: 8 }}>{current.name}</div>
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress[current.name] && (
            <div style={{ marginTop: 8, width: "80%", textAlign: "center" }}>
              <div
                style={{
                  height: 6,
                  backgroundColor: "#ccc",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    width: `${uploadProgress[current.name]}%`,
                    height: "100%",
                    backgroundColor: "#4caf50",
                  }}
                />
              </div>
              <small style={{ color: isDark ? "#fff" : "#000" }}>
                Uploading: {uploadProgress[current.name]}%
              </small>
            </div>
          )}
        </div>

        {/* --- Navigation --- */}
        {previews.length > 1 && (
          <div style={{ display: "flex", marginTop: 12, gap: 16 }}>
            <button onClick={handlePrev} disabled={index === 0}>
              ‹ Prev
            </button>
            <span style={{ color: isDark ? "#fff" : "#000" }}>
              {index + 1} / {previews.length}
            </span>
            <button onClick={handleNext} disabled={index === previews.length - 1}>
              Next ›
            </button>
          </div>
        )}

        {/* --- Caption --- */}
        <textarea
          placeholder="Add a caption..."
          value={captions[current.name] || ""}
          onChange={(e) =>
            setCaptions((prev) => ({ ...prev, [current.name]: e.target.value }))
          }
          style={{
            marginTop: 12,
            width: "100%",
            padding: 8,
            borderRadius: 6,
            border: "1px solid #ccc",
            resize: "none",
            minHeight: 40,
          }}
        />

        {/* --- Controls --- */}
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button
            onClick={() => onRemove(index)}
            style={{
              padding: "8px 16px",
              backgroundColor: "red",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
          <button
            onClick={handleSend}
            disabled={sending || disabled}
            style={{
              padding: "8px 16px",
              backgroundColor: isDark ? "#4caf50" : "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: sending || disabled ? "not-allowed" : "pointer",
            }}
          >
            {sending
              ? "Sending..."
              : previews.length > 1
              ? `Send (${previews.length})`
              : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}