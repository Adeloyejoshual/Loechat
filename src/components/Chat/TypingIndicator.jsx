// src/components/Chat/TypingIndicator.jsx
import React from "react";

export default function TypingIndicator({ isTyping, isDark }) {
  if (!isTyping) return null;

  const dotStyle = (delay) => ({
    width: 8,
    height: 8,
    margin: 2,
    borderRadius: "50%",
    backgroundColor: isDark ? "#fff" : "#333",
    display: "inline-block",
    animation: `bounce 1.2s infinite ${delay}s`,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: 8, margin: "4px 0" }}>
      <span style={dotStyle(0)}></span>
      <span style={dotStyle(0.2)}></span>
      <span style={dotStyle(0.4)}></span>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}