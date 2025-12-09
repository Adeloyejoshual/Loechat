// src/components/Chat/MediaViewer.jsx
import React, { useState, useRef, useEffect } from "react";

export default function MediaViewer({ items = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const mediaRef = useRef(null);

  useEffect(() => setIndex(startIndex), [startIndex]);

  if (!items.length) return null;
  const current = items[index];

  // ---------------- SWIPE ----------------
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Swipe down to close
    if (diffY > 100) return onClose?.();

    if (diffX > 80 && index > 0) {
      setIndex((p) => p - 1);
      setScale(1);
    } else if (diffX < -80 && index < items.length - 1) {
      setIndex((p) => p + 1);
      setScale(1);
    }
  };

  // ---------------- DOUBLE TAP ZOOM ----------------
  const handleDoubleClick = () => {
    if (current.type === "image") setScale((p) => (p === 1 ? 2 : 1));
  };

  // Pause video when switching
  useEffect(() => {
    if (mediaRef.current?.tagName === "VIDEO") {
      mediaRef.current.pause();
      mediaRef.current.currentTime = 0;
    }
  }, [index]);

  // ---------------- SAVE ----------------
  const handleSave = async () => {
    try {
      const response = await fetch(current.url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "media";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to save file");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
      onClick={onClose}
    >
      {/* HEADER */}
      <div
        style={{
          height: 56,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff",
          background: "rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span>{index + 1} / {items.length}</span>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={handleSave} style={iconBtn}>⭳</button>
          <button onClick={onClose} style={iconBtn}>✕</button>
        </div>
      </div>

      {/* MEDIA BODY */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {current.type === "video" ? (
          <video
            ref={mediaRef}
            src={current.url}
            controls
            autoPlay
            style={{ maxWidth: "100%", maxHeight: "100%" }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            ref={mediaRef}
            src={current.url}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              transform: `scale(${scale})`,
              transition: "transform 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* NAVIGATION */}
      <div
        style={{
          height: 50,
          display: "flex",
          justifyContent: "space-between",
          padding: "0 18px",
          alignItems: "center",
          color: "#aaa",
        }}
      >
        <span
          onClick={() => index > 0 && setIndex(index - 1)}
          style={{ cursor: index > 0 ? "pointer" : "not-allowed" }}
        >
          ◀ Prev
        </span>
        <span
          onClick={() => index < items.length - 1 && setIndex(index + 1)}
          style={{ cursor: index < items.length - 1 ? "pointer" : "not-allowed" }}
        >
          Next ▶
        </span>
      </div>
    </div>
  );
}

const iconBtn = { background: "none", color: "#fff", border: "none", fontSize: 22, cursor: "pointer" };