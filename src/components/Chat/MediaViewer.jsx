import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaDownload, FaChevronLeft, FaChevronRight } from "react-icons/fa";

export default function MediaViewer({ items = [], startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex]);

  if (!items.length) return null;

  const prev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : i));
  const next = () => setCurrentIndex((i) => (i < items.length - 1 ? i + 1 : i));

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const distance = touchEndX.current - touchStartX.current;
    const threshold = 50; // minimum swipe distance
    if (distance > threshold) prev();
    else if (distance < -threshold) next();
  };

  const current = items[currentIndex];

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.95)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
        flexDirection: "column",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          fontSize: 24,
          background: "none",
          border: "none",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        <FaTimes />
      </button>

      {/* Download button */}
      <a
        href={current.url}
        download
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          fontSize: 20,
          color: "#fff",
          textDecoration: "none",
        }}
      >
        <FaDownload />
      </a>

      {/* Media */}
      <div
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {current.type === "image" ? (
          <img
            src={current.url}
            alt="media"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
              objectFit: "contain",
            }}
          />
        ) : (
          <video
            src={current.url}
            controls
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
            }}
          />
        )}

        {/* Previous */}
        {currentIndex > 0 && (
          <button
            onClick={prev}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 28,
              background: "rgba(0,0,0,0.3)",
              border: "none",
              color: "#fff",
              padding: 8,
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            <FaChevronLeft />
          </button>
        )}

        {/* Next */}
        {currentIndex < items.length - 1 && (
          <button
            onClick={next}
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 28,
              background: "rgba(0,0,0,0.3)",
              border: "none",
              color: "#fff",
              padding: 8,
              borderRadius: "50%",
              cursor: "pointer",
            }}
          >
            <FaChevronRight />
          </button>
        )}
      </div>

      {/* Counter */}
      <div style={{ marginTop: 12, color: "#fff", fontSize: 14 }}>
        {currentIndex + 1} / {items.length}
      </div>
    </div>,
    document.body
  );
}