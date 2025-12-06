import React, { useState, useEffect, useRef } from "react";

export default function ImagePreviewModal({
  files = [],            // Array of File objects
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
  const [caption, setCaption] = useState(""); // single caption for all images
  const startY = useRef(0);

  useEffect(() => setIndex(currentIndex), [currentIndex]);

  if (!files.length) return null;

  const current = { file: files[index], url: URL.createObjectURL(files[index]) };

  // Next / Prev
  const handleNext = () => setIndex((p) => (p + 1 < files.length ? p + 1 : p));
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

  const handleSend = () => {
    onSend(files, caption); // pass all files + single caption
    onClose(); // close modal after sending
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
            style={{ maxHeight: "70vh", maxWidth: "70vw", borderRadius: 8 }}
          />
        ) : (
          <img
            src={current.url}
            alt="preview"
            style={{ maxHeight: "70vh", maxWidth: "70vw", borderRadius: 8, userSelect: "none" }}
            draggable={false}
          />
        )}

        {/* Next */}
        <button
          onClick={handleNext}
          disabled={index === files.length - 1}
          style={{
            background: "transparent",
            border: "none",
            fontSize: 32,
            color: isDark ? "#fff" : "#000",
            cursor: index === files.length - 1 ? "not-allowed" : "pointer",
            marginLeft: 8,
          }}
        >
          ›
        </button>
      </div>

      {/* Caption Input */}
      <input
        type="text"
        placeholder="Add a caption for all images..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        style={{
          marginTop: 12,
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #ccc",
          width: "80%",
          outline: "none",
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
      {files.length > 1 && (
        <div style={{ marginTop: 12, color: isDark ? "#fff" : "#000", fontSize: 14 }}>
          {index + 1} / {files.length}
        </div>
      )}
    </div>
  );
}