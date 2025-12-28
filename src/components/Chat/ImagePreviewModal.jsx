// src/components/Chat/ImagePreviewModal.jsx
import React, { useState, useRef, useEffect } from "react";

export default function ImagePreviewModal({
  previews = [],
  onRemove = () => {},
  onClose = () => {},
  onSend = async () => {},
  isDark = false,
  disabled = false,
}) {
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [caption, setCaption] = useState("");

  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  if (!previews.length) return null;
  const current = previews[index];

  const handleNext = () =>
    setIndex((i) => Math.min(i + 1, previews.length - 1));
  const handlePrev = () =>
    setIndex((i) => Math.max(i - 1, 0));

  /* ---------------- Touch swipe ---------------- */
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    startPos.current = { x: t.clientX, y: t.clientY };
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const t = e.touches[0];
    setTranslate({
      x: t.clientX - startPos.current.x,
      y: t.clientY - startPos.current.y,
    });
  };

  const handleTouchEnd = () => {
    isDragging.current = false;

    if (translate.y > 120) {
      onClose(); // swipe down to close
      return;
    }

    if (translate.x < -80 && index < previews.length - 1) handleNext();
    if (translate.x > 80 && index > 0) handlePrev();

    setTranslate({ x: 0, y: 0 });
  };

  /* ---------------- Send ---------------- */
  const handleSend = async () => {
    if (sending || disabled) return;
    setSending(true);

    try {
      await onSend(previews.map((p) => p.file), caption.trim());
      setCaption("");
      onClose();
    } catch (e) {
      console.error(e);
      setSending(false);
    }
  };

  /* ---------------- Cleanup URLs ---------------- */
  useEffect(() => {
    return () =>
      previews.forEach(
        (p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)
      );
  }, [previews]);

  return (
    /* 🔥 BACKDROP */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: isDark
          ? "rgba(0,0,0,0.9)"
          : "rgba(255,255,255,0.9)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
      }}
    >
      {/* 🔥 MODAL CONTENT */}
      <div
        onClick={(e) => e.stopPropagation()} // ⛔ prevent close
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Media */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px)`,
            transition: "transform 0.25s ease",
            maxWidth: "100%",
          }}
        >
          {current.file.type.startsWith("image/") && (
            <img
              src={current.previewUrl}
              alt=""
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          )}

          {current.file.type.startsWith("video/") && (
            <video
              src={current.previewUrl}
              controls
              style={{ maxWidth: "100%", borderRadius: 8 }}
            />
          )}

          {current.file.type.startsWith("audio/") && (
            <div style={{ textAlign: "center" }}>
              <audio controls src={current.previewUrl} />
              <div>{current.file.name}</div>
            </div>
          )}

          {!current.file.type.match(/image|video|audio/) && (
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 40 }}>📄</span>
              <div>{current.file.name}</div>
            </div>
          )}
        </div>

        {/* Caption */}
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption..."
          style={{
            marginTop: 12,
            width: "100%",
            padding: 8,
            borderRadius: 6,
          }}
        />

        {/* Buttons */}
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={() => onRemove(index)}
            style={{ background: "red", color: "#fff", padding: "8px 16px" }}
          >
            Remove
          </button>

          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: "#1976d2",
              color: "#fff",
              padding: "8px 16px",
            }}
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}