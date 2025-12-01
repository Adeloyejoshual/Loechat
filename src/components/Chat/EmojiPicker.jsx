// src/components/Chat/EmojiPicker.jsx
import React, { useEffect, useRef } from "react";

const ALL = [
  "🤔","❤️‍🔥","❤️","👍","👎","🔥","🥰","👏",
  "😁","🍿","😱","🤬","😔","🎉","🤩","🤢",
  "💩","🙏","👌","🕊️","🤡","😐","😏","😍",
  "🐋","🌚","🌭","💯","🤣","⚡","🍌","🏆",
  "💔","😶","😑","🍓","🍾","💋","🖕","😈",
  "😴","😭","🤓","👻","🧑‍💻","👀","🎃","🙈",
  "😇","🥳","🥶","🥲","🫣","🫡","🫠","🫢",
  "🫰","🫱","🫲","🫵","🫴","🫶","🫷","🫸",
  "🌝","🌞","🌛","🌜","🌙","⭐","🌟","☄️",
  "💫","✨","⚡","🔥","❄️","☃️","💥","🌪️"
];

export default function EmojiPicker({ onSelect, onClose, position }) {
  const pickerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      style={{
        position: "absolute",
        top: position?.top ?? -60,
        left: position?.left ?? 0,
        background: "#fff",
        borderRadius: 22,
        padding: 8,
        boxShadow: "0 8px 20px rgba(0,0,0,0.20)",
        zIndex: 2000,
        width: "90vw",
        maxWidth: 340,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(32px, 1fr))",
          gap: 8,
          maxHeight: "45vh",
          overflowY: "auto",
          padding: 6,
          touchAction: "pan-y",
        }}
      >
        {ALL.map((emoji) => (
          <span
            key={emoji}
            onClick={() => onSelect(emoji)}
            style={{ fontSize: 26, cursor: "pointer" }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  );
}