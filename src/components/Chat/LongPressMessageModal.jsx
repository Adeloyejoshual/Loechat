// src/components/Chat/LongPressMessageModal.jsx
import React from "react";
import { FaRegSmile, FaReply, FaTrash, FaThumbtack, FaCopy } from "react-icons/fa";

export default function LongPressMessageModal({
  message,
  onClose,
  onReaction,
  onReply,
  onCopy,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  isDark,
}) {
  if (!message) return null;

  const bgColor = isDark ? "#1c1c1c" : "#fff";
  const textColor = isDark ? "#fff" : "#000";
  const borderColor = isDark ? "#333" : "#ccc";

  const reactions = ["👍", "❤️", "😂", "😮", "😢", "👏"];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          borderRadius: 12,
          minWidth: 280,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        {/* Reactions */}
        <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 12 }}>
          {reactions.map((r) => (
            <button
              key={r}
              onClick={() => onReaction(r)}
              style={{
                fontSize: 20,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ActionButton icon={<FaReply />} label="Reply" onClick={onReply} textColor={textColor} borderColor={borderColor} />
          <ActionButton icon={<FaCopy />} label="Copy" onClick={onCopy} textColor={textColor} borderColor={borderColor} />
          <ActionButton icon={<FaThumbtack />} label="Pin" onClick={onPin} textColor={textColor} borderColor={borderColor} />
          <ActionButton icon={<FaTrash />} label="Delete for me" onClick={onDeleteForMe} textColor={textColor} borderColor={borderColor} />
          <ActionButton icon={<FaTrash />} label="Delete for everyone" onClick={onDeleteForEveryone} textColor={textColor} borderColor={borderColor} />
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 12,
            padding: 8,
            borderRadius: 8,
            border: `1px solid ${borderColor}`,
            backgroundColor: bgColor,
            color: textColor,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, textColor, borderColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        backgroundColor: "transparent",
        color: textColor,
        cursor: "pointer",
        fontSize: 14,
        width: "100%",
      }}
    >
      {icon} {label}
    </button>
  );
}