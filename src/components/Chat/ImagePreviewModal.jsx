// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useEffect } from "react";

export default function ImagePreviewModal({
  previews = [],          // [{ file, url }]
  currentIndex = 0,
  onRemove = () => {},
  onClose = () => {},
  onSend = () => {},
  isDark = false,
}) {
  const [index, setIndex] = useState(currentIndex);

  useEffect(() => {
    setIndex(currentIndex);
  }, [currentIndex]);

  if (!previews.length) return null;

  const handleNext = () => setIndex((prev) => (prev + 1 < previews.length ? prev + 1 : prev));
  const handlePrev = () => setIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));

  const current = previews[index];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: isDark ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.9)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
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
          fontSize: 24,
          cursor: "pointer",
        }}
      >
        ×
      </button>

      {/* Media Preview */}
      <div style={{ display: "flex", alignItems: "center", maxWidth: "90%", maxHeight: "80%" }}>
        {/* Prev */}
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

        {/* Image or Video */}
        {current.file.type.startsWith("video/") ? (
          <video
            src={current.url}
            controls
            style={{ maxHeight: "80vh", maxWidth: "80vw", borderRadius: 8 }}
          />
        ) : (
          <img
            src={current.url}
            alt="preview"
            style={{ maxHeight: "80vh", maxWidth: "80vw", borderRadius: 8 }}
          />
        )}

        {/* Next */}
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
          onClick={onSend}
          style={{
            padding: "8px 16px",
            backgroundColor: isDark ? "#4caf50" : "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>

      {/* Pagination */}
      {previews.length > 1 && (
        <div style={{ marginTop: 12, color: isDark ? "#fff" : "#000", fontSize: 14 }}>
          {index + 1} / {previews.length}
        </div>
      )}
    </div>
  );
}