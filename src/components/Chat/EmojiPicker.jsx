// src/components/Chat/EmojiPicker.jsx
import React, { useEffect, useRef } from "react";

const EMOJIS = [
  "😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇",
  "🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚",
  "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
  "🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥",
  "😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮",
  "🤧","🥵","🥶","🥴","😵","🤯","🤠","🥳","😎","🤓",
  "🧐","😕","😟","🙁","☹️","😮","😯","😲","😳","🥺",
  "😦","😧","😨","😰","😥","😢","😭","😱","😖","😣",
  "😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈",
  "👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾",
  "🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾"
];

export default function EmojiPicker({ open = false, onClose, onSelect, isDark = false, maxHeightPct = 0.5 }) {
  const pickerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        ref={pickerRef}
        style={{
          width: "100%",
          maxWidth: 400,
          maxHeight: `${maxHeightPct * 100}%`,
          background: isDark ? "#1c1c1c" : "#fff",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 12,
          overflowY: "auto",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.25)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
          gap: 8,
        }}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect?.(emoji)}
            style={{
              fontSize: 24,
              cursor: "pointer",
              border: "none",
              background: "transparent",
              padding: 6,
              borderRadius: 8,
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}