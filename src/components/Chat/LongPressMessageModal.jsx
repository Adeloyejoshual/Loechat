import React, { useEffect, useMemo, useRef, useState } from "react"; import { createPortal } from "react-dom";

// Emoji categories (trimmed but expandable) const CATEGORIES = [ { id: "smileys", title: "Smileys", emojis: [ "😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","🙂","🙃","😍","😘","😗","😙","😚","😋","😜","🤪","😝","🤩","🥳","🤔","🤨","🤯","🤗","🤥" ], }, { id: "people", title: "People", emojis: ["🧑","👩","👨","🧒","👶","🧓","👴","👵","🧑‍💻","👮‍♀️","👷‍♂️","💂‍♀️","🕵️"] }, { id: "heart", title: "Hearts", emojis: ["❤️","💛","💚","💙","💜","🖤","🤍","🤎","💔","💕","💞","💓","💗"] }, { id: "gestures", title: "Gestures", emojis: ["👍","👎","👏","🙌","🙏","🤝","🤟","👌","✌️","🤘","🫶"] }, { id: "animals", title: "Animals", emojis: ["🐶","🐱","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔"] }, { id: "food", title: "Food", emojis: ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🍔","🍟","🍕","🍿","🍩"] }, { id: "activities", title: "Activities", emojis: ["⚽","🏀","🏈","⚾","🎾","🏐","🏆","🎮","🎲"] }, { id: "symbols", title: "Symbols", emojis: ["⭐","🌟","🔥","⚡","✨","💥","💫","❄️","☀️","🌈"] } ];

export default function EmojiBottomSheet({ isOpen, onClose, onSelect, initialCategory = "smileys", isDark = false, height = "72vh", }) { const [query, setQuery] = useState(""); const [activeCat, setActiveCat] = useState(initialCategory); const sheetRef = useRef(null); const containerRef = useRef(null); const catRefs = useRef({});

useEffect(() => { if (isOpen) { document.body.style.overflow = "hidden"; // small delay to animate in requestAnimationFrame(() => { sheetRef.current?.classList.remove("translate-y-full"); }); } else { document.body.style.overflow = ""; } return () => (document.body.style.overflow = ""); }, [isOpen]);

useEffect(() => { const onKey = (e) => { if (e.key === "Escape") onClose?.(); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [onClose]);

const flatEmojis = useMemo(() => { if (!query?.trim()) return null; const q = query.toLowerCase(); // search by emoji character or category title return CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(q) || (e && false)); }, [query]);

const displayed = useMemo(() => { if (flatEmojis) return { search: flatEmojis }; const map = {}; for (const cat of CATEGORIES) map[cat.id] = cat.emojis; return map; }, [flatEmojis]);

const scrollToCategory = (id) => { setActiveCat(id); const node = catRefs.current[id]; if (node && containerRef.current) { node.scrollIntoView({ behavior: "smooth", block: "start" }); } };

// update active category while scrolling large list useEffect(() => { if (!containerRef.current || flatEmojis) return; const container = containerRef.current; let ticking = false; const handle = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { let found = activeCat; for (const cat of CATEGORIES) { const el = catRefs.current[cat.id]; if (!el) continue; const rect = el.getBoundingClientRect(); const contRect = container.getBoundingClientRect(); if (rect.top - contRect.top <= 48) { found = cat.id; } else break; } if (found !== activeCat) setActiveCat(found); ticking = false; }); }; container.addEventListener("scroll", handle, { passive: true }); return () => container.removeEventListener("scroll", handle); }, [activeCat, flatEmojis]);

if (!isOpen) return null;

return createPortal( <div className={fixed inset-0 z-50 flex items-end justify-center}> {/* backdrop */} <div
onClick={onClose}
className="absolute inset-0 bg-black/40"
aria-hidden
/>

{/* sheet */}
  <div
    ref={sheetRef}
    className={`relative w-full max-w-2xl mx-auto rounded-t-2xl bg-white dark:bg-[#0b0b0b] translate-y-full transition-transform duration-220 ease-out`} 
    style={{ height, boxShadow: "0 -20px 40px rgba(0,0,0,0.18)" }}
    onClick={(e) => e.stopPropagation()}
  >
    {/* drag handle */}
    <div className="w-full flex justify-center p-3">
      <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
    </div>

    {/* header: search + close */}
    <div className="px-4 pb-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Emoji</div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emojis or paste any emoji"
            className="mt-2 w-full rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111] focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-800 dark:text-slate-200"
          />
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close emoji picker"
        >
          ✕
        </button>
      </div>
    </div>

    {/* categories row (sticky) */}
    <div className="px-3">
      <div className="flex gap-2 overflow-x-auto py-2 scrollbar-hide">
        {flatEmojis ? (
          <div className="px-2 py-1 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">Search results</div>
        ) : (
          CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCategory(c.id)}
              className={`px-3 py-1 rounded-lg whitespace-nowrap text-sm ${activeCat === c.id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}
            >
              {c.title}
            </button>
          ))
        )}
      </div>
    </div>

    {/* emoji grid container */}
    <div
      ref={containerRef}
      className="px-3 pb-6 overflow-y-auto h-[calc(100%-160px)] touch-pan-y"
    >
      {/* search results */}
      {flatEmojis ? (
        <div className="grid grid-cols-8 gap-2 p-1">
          {flatEmojis.map((e, i) => (
            <button
              key={`${e}-${i}`}
              onClick={() => onSelect?.(e)}
              className="text-2xl p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {e}
            </button>
          ))}
        </div>
      ) : (
        // full categories
        CATEGORIES.map((cat) => (
          <div key={cat.id} ref={(el) => (catRefs.current[cat.id] = el)} className="mb-4">
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300 px-1 py-2">{cat.title}</div>
            <div className="grid grid-cols-8 gap-2 p-1">
              {cat.emojis.map((e) => (
                <button
                  key={e}
                  onClick={() => onSelect?.(e)}
                  className="text-2xl p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* spacer so bottom isn't cut off */}
      <div style={{ height: 18 }} />
    </div>
  </div>
</div>,
document.body

); }
