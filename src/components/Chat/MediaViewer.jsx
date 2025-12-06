import React, { useState, useEffect, useRef } from "react";
import { FiX, FiChevronLeft, FiChevronRight, FiDownload } from "react-icons/fi";

export default function MediaViewer({ items = [], startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const deltaX = useRef(0);
  const deltaY = useRef(0);

  useEffect(() => setCurrentIndex(startIndex), [startIndex, items]);

  if (!items.length) return null;
  const currentItem = items[currentIndex];

  const handleNext = () => setCurrentIndex((i) => Math.min(i + 1, items.length - 1));
  const handlePrev = () => setCurrentIndex((i) => Math.max(i - 1, 0));

  // ---------------- Touch Events ----------------
  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    deltaX.current = 0;
    deltaY.current = 0;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    deltaX.current = e.touches[0].clientX - startX.current;
    deltaY.current = e.touches[0].clientY - startY.current;

    if (deltaY.current > 0) {
      setTranslateY(deltaY.current);
      setOpacity(Math.max(1 - deltaY.current / 300, 0.3));
      setScale(Math.max(1 - deltaY.current / 1000, 0.95));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // Horizontal swipe (prev/next)
    if (Math.abs(deltaX.current) > 50 && Math.abs(deltaY.current) < 50) {
      deltaX.current > 0 ? handlePrev() : handleNext();
    }

    // Swipe down to close
    if (deltaY.current > 100) {
      setTranslateY(500);
      setOpacity(0);
      setScale(0.95);
      setTimeout(onClose, 200);
    } else {
      setTranslateY(0);
      setOpacity(1);
      setScale(1);
    }
  };

  // ---------------- Save media ----------------
  const handleSave = () => {
    const link = document.createElement("a");
    link.href = currentItem.url;
    link.download = currentItem.type === "video" ? "video.mp4" : "image.jpg";
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
        opacity: opacity,
        transition: isDragging ? "none" : "opacity 0.2s ease",
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
          color: "#fff",
          fontSize: 24,
        }}
      >
        <FiX />
      </button>

      {/* Save Button */}
      <button
        onClick={handleSave}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(0,0,0,0.5)",
          border: "none",
          borderRadius: "50%",
          padding: 8,
          cursor: "pointer",
          color: "#fff",
          fontSize: 24,
        }}
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
            border: "none",
            borderRadius: "50%",
            padding: 8,
            cursor: "pointer",
            color: "#fff",
            fontSize: 24,
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
            border: "none",
            borderRadius: "50%",
            padding: 8,
            cursor: "pointer",
            color: "#fff",
            fontSize: 24,
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
          transform: `translateY(${translateY}px) scale(${scale})`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.25, 1.5, 0.5, 1)",
        }}
      >
        {currentItem.type === "image" && (
          <img
            key={currentIndex}
            src={currentItem.url}
            alt="media"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }}
          />
        )}
        {currentItem.type === "video" && (
          <video
            key={currentIndex}
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