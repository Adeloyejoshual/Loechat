// src/components/Chat/MediaViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import { FiX, FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function MediaViewer({ url, type, items = [], startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef(null);
  const startX = useRef(0);
  const deltaX = useRef(0);

  useEffect(() => {
    setCurrentIndex(startIndex);
  }, [startIndex]);

  const handleNext = () => {
    if (currentIndex < items.length - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
  };

  const handleTouchMove = (e) => {
    deltaX.current = e.touches[0].clientX - startX.current;
  };

  const handleTouchEnd = () => {
    if (deltaX.current > 50) handlePrev();
    else if (deltaX.current < -50) handleNext();
  };

  if (!items.length) return null;

  const currentItem = items[currentIndex];

  return (
    <div
      ref={containerRef}
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

      {/* Prev Button */}
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

      {/* Next Button */}
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

      {/* Media Display */}
      <div style={{ maxWidth: "90%", maxHeight: "90%", textAlign: "center" }}>
        {currentItem.type === "image" && (
          <img
            src={currentItem.url}
            alt="media"
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }}
          />
        )}
        {currentItem.type === "video" && (
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