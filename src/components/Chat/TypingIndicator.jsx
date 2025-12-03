import React from "react";

const dotStyle = {
  display: "inline-block",
  width: 6,
  height: 6,
  margin: "0 2px",
  backgroundColor: "#555",
  borderRadius: "50%",
  animation: "typingBounce 1.2s infinite ease-in-out",
};

export default function TypingIndicator({ userName = "Someone", isDark = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 12,
        fontStyle: "italic",
        color: isDark ? "#ccc" : "#555",
        marginTop: 4,
      }}
    >
      <span style={{ marginRight: 4 }}>{userName} typing</span>
      <span style={{ ...dotStyle, animationDelay: "0s" }} />
      <span style={{ ...dotStyle, animationDelay: "0.2s" }} />
      <span style={{ ...dotStyle, animationDelay: "0.4s" }} />

      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}