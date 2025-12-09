import React, { useState, useRef, useEffect } from "react";

export default function ImagePreviewModal({
  previews = [], // [{ file, previewUrl }]
  caption: initialCaption = "",
  setCaption = () => {},
  onRemove = () => {},
  onClose = () => {},
  onSend = async () => {}, // (files, caption) => {}
  isDark = false,
  disabled = false,
}) {
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const [caption, setLocalCaption] = useState(initialCaption);

  if (!previews.length) return null;
  const current = previews[index];

  const handleNext = () => setIndex((i) => Math.min(i + 1, previews.length - 1));
  const handlePrev = () => setIndex((i) => Math.max(i - 1, 0));

  // --- Touch handlers ---
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
    if (y > 120) return onClose();
    if (x < -80 && index < previews.length - 1) handleNext();
    else if (x > 80 && index > 0) handlePrev();
    setTranslate({ x: 0, y: 0 });
  };

  // --- Send handler ---
  const handleSend = async () => {
    if (sending || disabled) return;
    setSending(true);
    try {
      await onSend(previews.map((p) => p.file), caption || "");
      setLocalCaption("");
      onClose();
    } catch (err) {
      console.error("Send failed", err);
      setSending(false);
    }
  };

  useEffect(() => {
    return () => previews.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
  }, [previews]);

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
        padding: 12,
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "transparent",
          border: "none",
          color: isDark ? "#fff" : "#000",
          fontSize: 28,
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
          transform: `translate(${translate.x}px, ${translate.y}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
          touchAction: "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {current.file.type.startsWith("video/") ? (
          <video
            src={current.previewUrl || URL.createObjectURL(current.file)}
            controls
            style={{ maxHeight: "60vh", maxWidth: "80vw", borderRadius: 8 }}
          />
        ) : (
          <img
            src={current.previewUrl || URL.createObjectURL(current.file)}
            alt="preview"
            style={{ maxHeight: "60vh", maxWidth: "80vw", borderRadius: 8 }}
            draggable={false}
          />
        )}
      </div>

      {/* Navigation */}
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

      {/* Caption */}
      <textarea
        placeholder="Add a caption..."
        value={caption}
        onChange={(e) => setLocalCaption(e.target.value)}
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
    {sending
      ? "Sending..."
      : previews.length > 1
      ? `Send (${previews.length})`
      : "Send"}
  </button>
</div>
    </div>
  );
}