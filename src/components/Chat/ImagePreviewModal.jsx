// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useRef } from "react";

export default function ImagePreviewModal({
  previews = [], // [{ file, url }]
  caption: initialCaption = "",
  setCaption = () => {},
  onRemove = () => {},
  onClose = () => {},
  onSend = async () => {},
  isDark = false,
  disabled = false, // disable send while uploading
}) {
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  if (!previews.length) return null;

  const current = previews[index];

  const handleNext = () => setIndex((p) => (p + 1 < previews.length ? p + 1 : p));
  const handlePrev = () => setIndex((p) => (p - 1 >= 0 ? p - 1 : p));

  // Touch swipe to close
  const handleTouchStart = (e) => {
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setTranslateY(dy);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (translateY > 120) onClose();
    setTranslateY(0);
  };

  const handleSend = async () => {
    if (sending || disabled) return;
    setSending(true);
    try {
      await onSend(initialCaption); // send all files with single caption
      setCaption(""); // clear caption
      onClose();
    } catch (err) {
      console.error(err);
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        transition: isDragging ? "none" : "background 0.2s ease",
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "transparent",
          border: "none",
          color: isDark ? "#fff" : "#000",
          fontSize: 26,
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {/* Media Preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          maxWidth: "90%",
          maxHeight: "70%",
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
          touchAction: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={handlePrev}
          disabled={index === 0}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 32,
            color: isDark ? "#fff" : "#000",
            cursor: index === 0 ? "not-allowed" : "pointer",
            marginRight: 8,
          }}
        >
          ‹
        </button>

        {current.file.type.startsWith("video/") ? (
          <video
            src={current.url}
            controls
            style={{ maxHeight: "60vh", maxWidth: "80vw", borderRadius: 8 }}
          />
        ) : (
          <img
            src={current.url}
            alt="preview"
            style={{ maxHeight: "60vh", maxWidth: "80vw", borderRadius: 8 }}
            draggable={false}
          />
        )}

        <button
          onClick={handleNext}
          disabled={index === previews.length - 1}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 32,
            color: isDark ? "#fff" : "#000",
            cursor: index === previews.length - 1 ? "not-allowed" : "pointer",
            marginLeft: 8,
          }}
        >
          ›
        </button>
      </div>

      {/* Caption Input */}
      <textarea
        placeholder="Add a caption..."
        value={initialCaption}
        onChange={(e) => setCaption(e.target.value)}
        style={{
          marginTop: 12,
          width: "80%",
          padding: 8,
          borderRadius: 6,
          border: "1px solid #ccc",
          resize: "none",
          minHeight: 40,
        }}
      />

      {/* Controls */}
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
          {sending ? "Sending..." : "Send"}
        </button>
      </div>

      {/* Index Indicator */}
      {previews.length > 1 && (
        <div style={{ marginTop: 12, color: isDark ? "#fff" : "#000", fontSize: 14 }}>
          {index + 1} / {previews.length}
        </div>
      )}
    </div>
  );
}