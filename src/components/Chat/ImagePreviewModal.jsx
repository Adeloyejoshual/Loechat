// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useEffect, useRef } from "react";

export default function ImagePreviewModal({
  previews = [],            // Array of { file, url }
  caption = "",
  setCaption = () => {},
  currentIndex = 0,
  onRemove = () => {},
  onClose = () => {},
  onSend = () => {},
  onAddFiles = () => {},
  isDark = false,
}) {
  const [index, setIndex] = useState(currentIndex);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => setIndex(currentIndex), [currentIndex]);

  if (!previews.length) return null;

  const current = previews[index];

  // Next / Prev
  const handleNext = () => setIndex((p) => (p + 1 < previews.length ? p + 1 : p));
  const handlePrev = () => setIndex((p) => (p - 1 >= 0 ? p - 1 : p));

  // Swipe-down handlers
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
          maxHeight: "60%",
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
          touchAction: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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

        {/* Image / Video */}
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
            style={{ maxHeight: "60vh", maxWidth: "80vw", borderRadius: 8, userSelect: "none" }}
            draggable={false}
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

      {/* Caption input */}
      <input
        type="text"
        placeholder="Write a caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        style={{
          marginTop: 12,
          padding: "8px 12px",
          width: "80%",
          borderRadius: 6,
          border: `1px solid ${isDark ? "#555" : "#ccc"}`,
          backgroundColor: isDark ? "#222" : "#fff",
          color: isDark ? "#fff" : "#000",
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
        <button
          onClick={onAddFiles}
          style={{
            padding: "8px 16px",
            backgroundColor: isDark ? "#555" : "#888",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Add More
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