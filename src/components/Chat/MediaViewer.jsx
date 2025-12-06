// src/components/Chat/MediaViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import { FiX, FiChevronLeft, FiChevronRight, FiDownload } from "react-icons/fi";

export default function MediaViewer({ items = [], startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const lastTouchDistance = useRef(null);
  const lastTap = useRef(0);

  const startPos = useRef({ x: 0, y: 0 });
  const delta = useRef({ x: 0, y: 0 });

  useEffect(() => setCurrentIndex(startIndex), [startIndex]);

  if (!items.length) return null;
  const currentItem = items[currentIndex];

  // ---------------- Navigation ----------------
  const handleNext = () => {
    resetTransform();
    setCurrentIndex((i) => Math.min(i + 1, items.length - 1));
  };
  const handlePrev = () => {
    resetTransform();
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  // ---------------- Transform Helpers ----------------
  const resetTransform = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    lastTouchDistance.current = null;
  };

  // ---------------- Touch Handlers ----------------
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      delta.current = { x: 0, y: 0 };
      setIsDragging(true);

      // Double-tap zoom
      const now = Date.now();
      if (now - lastTap.current < 300) {
        setScale((prev) => (prev === 1 ? 2 : 1));
        setTranslate({ x: 0, y: 0 });
      }
      lastTap.current = now;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && scale > 1) {
      // Drag image when zoomed
      delta.current = {
        x: e.touches[0].clientX - startPos.current.x,
        y: e.touches[0].clientY - startPos.current.y,
      };
      setTranslate({ x: delta.current.x, y: delta.current.y });
    } else if (e.touches.length === 2) {
      // Pinch-to-zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      if (lastTouchDistance.current) {
        let newScale = (scale * distance) / lastTouchDistance.current;
        if (newScale < 1) newScale = 1;
        if (newScale > 4) newScale = 4;
        setScale(newScale);
      }
      lastTouchDistance.current = distance;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistance.current = null;

    // Swipe left/right to navigate
    if (Math.abs(delta.current.x) > 50 && Math.abs(delta.current.y) < 50 && scale === 1) {
      if (delta.current.x > 0) handlePrev();
      else handleNext();
    }

    // Swipe down to close
    if (delta.current.y > 120 && scale === 1) {
      setOpacity(0);
      setTimeout(onClose, 200);
    }

    // Reset translation if not zoomed
    if (scale === 1) setTranslate({ x: 0, y: 0 });
  };

  // ---------------- Download ----------------
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentItem.url;
    link.download = currentItem.url.split("/").pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.95)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        touchAction: "none",
        opacity: opacity,
        transition: "opacity 0.2s ease",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.5)",
          borderRadius: "50%",
          padding: 8,
          color: "#fff",
          fontSize: 24,
          border: "none",
          cursor: "pointer",
        }}
      >
        <FiX />
      </button>

      {/* Download */}
      <button
        onClick={handleDownload}
        style={{
          position: "absolute",
          top: 20,
          right: 70,
          background: "rgba(0,0,0,0.5)",
          borderRadius: "50%",
          padding: 8,
          color: "#fff",
          fontSize: 24,
          border: "none",
          cursor: "pointer",
        }}
        title="Download"
      >
        <FiDownload />
      </button>

      {/* Prev/Next */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrev}
          style={{
            position: "absolute",
            left: 20,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.5)",
            borderRadius: "50%",
            padding: 8,
            color: "#fff",
            fontSize: 24,
            border: "none",
            cursor: "pointer",
          }}
        >
          <FiChevronLeft />
        </button>
      )}
      {currentIndex < items.length - 1 && (
        <button
          onClick={handleNext}
          style={{
            position: "absolute",
            right: 20,
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(0,0,0,0.5)",
            borderRadius: "50%",
            padding: 8,
            color: "#fff",
            fontSize: 24,
            border: "none",
            cursor: "pointer",
          }}
        >
          <FiChevronRight />
        </button>
      )}

      {/* Media */}
      <div
        style={{
          maxWidth: "90%",
          maxHeight: "90%",
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transition: isDragging ? "none" : "transform 0.2s ease",
          borderRadius: 12,
          textAlign: "center",
        }}
      >
        {currentItem.type === "image" ? (
          <img
            src={currentItem.url}
            alt="media"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }}
          />
        ) : (
          <video
            src={currentItem.url}
            controls
            autoPlay
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }}
          />
        )}
      </div>

      {/* Indicator */}
      {items.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            fontSize: 14,
          }}
        >
          {currentIndex + 1} / {items.length}
        </div>
      )}
    </div>
  );
}