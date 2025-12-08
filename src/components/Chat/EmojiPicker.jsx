import React, { useEffect, useRef } from "react";

const EMOJIS = [
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

export default function EmojiPicker({ onSelect, onClose, position, isDark = false }) {
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const backgroundColor = isDark ? "#1b1b1b" : "#fff";

  return (
    <div
      ref={pickerRef}
      style={{
        position: "absolute",
        top: position?.top ?? -60,
        left: position?.left ?? 0,
        background: backgroundColor,
        borderRadius: 20,
        padding: 10,
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
        zIndex: 2000,
        width: "90vw",
        maxWidth: 340,
        overscrollBehavior: "contain",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(36px, 1fr))",
          gap: 8,
          maxHeight: "45vh",
          overflowY: "auto",
          padding: 4,
          touchAction: "pan-y",
        }}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            style={{
              fontSize: 26,
              cursor: "pointer",
              background: "transparent",
              border: "none",
              padding: 4,
              borderRadius: 8,
              transition: "transform 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}