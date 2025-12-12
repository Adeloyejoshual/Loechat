// src/components/Chat/EmojiPicker.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";

const CATEGORY_DATA = [
  { id: "recent", label: "Recent", emojis: [] },
  { id: "smileys", label: "Smileys", emojis: ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😇","🙂","🙃","😍","😘","😗","😙","😚","😋","😜","😝","😛","🫠","🤪","🤨","🧐","🤓","😎","🥳","🤩"] },
  { id: "people", label: "People", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","🫶","👏","🙌","👐","🤝","👍","👎","☝️","👇","👆","🫱","🫲","🫳","🫴","🫵","🙏","✍️"] },
  { id: "animals", label: "Animals", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🦄","🐝","🐛","🦋","🐌","🐞"] },
  { id: "food", label: "Food", emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥕","🌶️","🌽","🥔","🍠","🧄","🧅","🥐","🥯"] },
  { id: "activity", label: "Activities", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🥋","🎯","🎳","🎮","🎲","🧩","🛹","🎣","🧗","🏆","🏅","🥇","🥈","🥉","🏵️","🎗️","🎫","🎟️"] },
  { id: "travel", label: "Travel", emojis: ["🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🛴","🚲","🛵","🏍️","🛺","✈️","🛩️","🛫","🛬","🚀","🛸","⛵","🚢","🛶","🏝️","🏖️"] },
  { id: "objects", label: "Objects", emojis: ["⌚","📱","💻","🖥️","🖨️","🕹️","🧭","💡","🔦","📷","🎥","📺","🧯","🛢️","🔋","🔌","💳","🧰","🧲","🔧","🔨","🪓","⚒️","⛏️","🧪","🔬","🔭","🧯","🧱","🛠️"] },
  { id: "symbols", label: "Symbols", emojis: ["❤️","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","✨","⭐","🌟","⚡","🔥","💥","🌈","☀️","🌤️","🌧️","⛄","⚪","🔴","🔵","🔺"] },
];

const RECENT_KEY = "wc_emoji_recent_v1";
const MAX_RECENT = 28;

export default function EmojiPicker({ open = false, onClose = () => {}, onSelect = () => {}, isDark = false, maxHeightPct = 0.78 }) {
  const sheetRef = useRef(null);
  const scrollRef = useRef(null);
  const categoryRefs = useRef({});
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
  });
  const [activeCategory, setActiveCategory] = useState("smileys");

  // Prevent body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on ESC / outside click
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => e.key === "Escape" && onClose();
    const handleClick = (e) => { if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose(); };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick, { passive: true });
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [open, onClose]);

  const categories = useMemo(() => {
    const copy = CATEGORY_DATA.map(c => ({ ...c }));
    copy[0].emojis = recent;
    return copy;
  }, [recent]);

  const flatEmojis = useMemo(() => categories.flatMap(c => (c.emojis || []).map(e => ({ emoji: e, category: c.id }))), [categories]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return flatEmojis.filter(e => e.emoji.includes(q) || e.category.includes(q)).map(e => e.emoji);
  }, [search, flatEmojis]);

  const pushRecent = (emoji) => {
    try {
      setRecent(prev => {
        const next = [emoji, ...prev.filter(e => e !== emoji)].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch {}
  };

  const handleSelect = (emoji) => { pushRecent(emoji); onSelect(emoji); setTimeout(onClose, 120); };

  const goToCategory = (catId) => {
    const node = categoryRefs.current[catId];
    if (node && scrollRef.current) scrollRef.current.scrollTo({ top: node.offsetTop, behavior: "smooth" });
  };

  const renderCategorySection = (cat) => {
    const list = cat.emojis || [];
    return (
      <div key={cat.id} ref={el => (categoryRefs.current[cat.id] = el)} style={{ paddingBottom: 10 }}>
        <div style={{ padding: "8px 12px", fontSize: 13, color: isDark ? "#ddd" : "#444", fontWeight: 600 }}>{cat.label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8, padding: "0 8px 8px 8px" }}>
          {list.map(e => (
            <button key={e} onClick={() => handleSelect(e)} style={{ height: 44, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}>
              {e}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  const sheetHeight = Math.max(320, Math.round(window.innerHeight * Math.min(0.95, maxHeightPct)));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 12000, display: "flex", justifyContent: "center", alignItems: "flex-end", background: "rgba(0,0,0,0.22)" }}>
      <div ref={sheetRef} style={{ width: "100%", maxWidth: 720, height: sheetHeight, background: isDark ? "#121212" : "#fff", borderTopLeftRadius: 14, borderTopRightRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Handle */}
        <div style={{ padding: "8px 12px", borderBottom: `1px solid ${isDark ? "#1b1b1b" : "#eee"}` }}>
          <div style={{ width: 44, height: 6, background: isDark ? "#2b2b2b" : "#e6e6e6", borderRadius: 99, margin: "0 auto" }} />
        </div>

        {/* Search + Close */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search emoji" style={{ flex: 1, padding: "8px 12px", borderRadius: 12, border: `1px solid ${isDark ? "#222" : "#e8e8e8"}`, background: isDark ? "#0d0d0d" : "#fff", color: isDark ? "#fff" : "#111", fontSize: 15, outline: "none" }} />
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 8, cursor: "pointer", fontSize: 18, color: isDark ? "#ddd" : "#333" }}>✕</button>
        </div>

        {/* Categories Row */}
        <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "6px 10px", borderBottom: `1px solid ${isDark ? "#111" : "#f0f0f0"}`, background: isDark ? "#0f0f0f" : "#fff", position: "sticky", top: 0, zIndex: 10 }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => goToCategory(c.id)} style={{ padding: "6px 10px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14, background: activeCategory === c.id ? (isDark ? "#202020" : "#f0f0f0") : "transparent", color: isDark ? (activeCategory === c.id ? "#fff" : "#bbb") : activeCategory === c.id ? "#111" : "#555" }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 6, WebkitOverflowScrolling: "touch", background: isDark ? "#0a0a0a" : "#fafafa" }}>
          {searchResults ? (
            <div style={{ padding: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))", gap: 8 }}>
              {searchResults.length === 0 ? <div style={{ padding: 20, textAlign: "center", color: isDark ? "#888" : "#777" }}>No emojis found</div> :
                searchResults.map(e => <button key={e} onClick={() => handleSelect(e)} style={{ height: 48, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}>{e}</button>)}
            </div>
          ) : (
            categories.map(cat => renderCategorySection(cat))
          )}
        </div>
      </div>
    </div>
  );
}