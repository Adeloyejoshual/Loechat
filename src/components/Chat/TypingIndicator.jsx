// src/components/Chat/TypingIndicator.jsx
import React from "react";

export default function TypingIndicator({ isTyping, isDark, showText = false }) {
  if (!isTyping) return null;

  const dotStyle = (delay) => ({
    width: 8,
    height: 8,
    margin: 2,
    borderRadius: "50%",
    backgroundColor: isDark ? "#fff" : "#333",
    display: "inline-block",
    animation: `typing-bounce 1.2s infinite ${delay}s`,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        margin: "4px 0",
        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
        borderRadius: 12,
        maxWidth: 120,
      }}
    >
      <span style={dotStyle(0)} />
      <span style={dotStyle(0.2)} />
      <span style={dotStyle(0.4)} />
      {showText && (
        <span style={{ fontSize: 12, color: isDark ? "#fff" : "#333", marginLeft: 6 }}>
          typing...
        </span>
      )}

      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}