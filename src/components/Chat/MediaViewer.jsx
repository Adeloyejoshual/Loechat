import React, { useState, useRef } from "react";

export default function MediaViewer({ mediaFiles, startIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const lastTouch = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const doubleTapRef = useRef(0);

  const thresholdClose = 120;
  const thresholdSwipe = 80;

  const currentMedia = mediaFiles[currentIndex];

  const getDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [a, b] = touches;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      lastTouch.current = { x: startX.current, y: startY.current };
      isSwiping.current = true;
    } else if (e.touches.length === 2) {
      setLastTouchDistance(getDistance(e.touches));
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && lastTouch.current && scale === 1) {
      const dx = e.touches[0].clientX - lastTouch.current.x;
      const dy = e.touches[0].clientY - lastTouch.current.y;

      if (Math.abs(dy) > Math.abs(dx)) {
        // vertical swipe = dismiss
        setTranslate({ x: 0, y: dy * 0.5 });
      } else {
        // horizontal swipe = slide
        setTranslate({ x: dx, y: 0 });
      }
    } else if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      if (lastTouchDistance) {
        const newScale = Math.max(1, Math.min(3, scale * (dist / lastTouchDistance)));
        setScale(newScale);
      }
    }
  };

  const handleTouchEnd = () => {
    // Dismiss if swiped vertically enough
    if (Math.abs(translate.y) > thresholdClose && scale === 1) {
      onClose();
      return;
    }

    // Horizontal swipe
    if (translate.x > thresholdSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (translate.x < -thresholdSwipe && currentIndex < mediaFiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }

    // Reset
    setTranslate({ x: 0, y: 0 });
    lastTouch.current = null;
    setLastTouchDistance(null);
    isSwiping.current = false;
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - doubleTapRef.current < 300) {
      setScale(scale === 1 ? 2 : 1);
    }
    doubleTapRef.current = now;
  };

  const backgroundOpacity = Math.max(0.2, 0.92 - Math.abs(translate.y) / 400);

  const getSlideStyle = (idx) => {
    if (idx === currentIndex) {
      return {
        transform: `translateX(${translate.x}px) translateY(${translate.y}px) scale(${scale})`,
        transition: isSwiping.current ? "none" : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 35px rgba(0,0,0,0.5)",
      };
    } else if (idx === currentIndex - 1) {
      return {
        transform: `translateX(${-100 + translate.x / window.innerWidth * 100}%)`,
        transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 35px rgba(0,0,0,0.5)",
      };
    } else if (idx === currentIndex + 1) {
      return {
        transform: `translateX(${100 + translate.x / window.innerWidth * 100}%)`,
        transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 35px rgba(0,0,0,0.5)",
      };
    }
    return { display: "none" };
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: `rgba(0,0,0,${backgroundOpacity})`,
        zIndex: 99999,
        overflow: "hidden",
        backdropFilter: "blur(6px)",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {mediaFiles.map((media, idx) => (
        <div
          key={idx}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleTap}
          style={getSlideStyle(idx)}
        >
          {media.type === "image" && (
            <img
              src={media.url}
              alt=""
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: 12,
                userSelect: "none",
              }}
            />
          )}
          {media.type === "video" && (
            <video
              src={media.url}
              controls
              autoPlay
              style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12 }}
            />
          )}
        </div>
      ))}

      {/* Close Button */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          fontSize: 32,
          color: "#fff",
          cursor: "pointer",
          zIndex: 100000,
        }}
      >
        ✕
      </div>

      {/* Navigation Dots */}
      {mediaFiles.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            display: "flex",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {mediaFiles.map((_, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: i === currentIndex ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}