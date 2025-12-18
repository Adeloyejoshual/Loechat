// src/context/PopupContext.jsx
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { ThemeContext } from "./ThemeContext";

const PopupContext = createContext();
export const usePopup = () => useContext(PopupContext);

export const PopupProvider = ({ children }) => {
  const { theme } = useContext(ThemeContext);

  const [popup, setPopup] = useState({
    visible: false,
    content: null,
    autoHide: true,
  });

  const popupRef = useRef(null);
  const timerRef = useRef(null);

  // ---------------- SHOW POPUP ----------------
  const showPopup = (content, options = {}) => {
    const { autoHide = true } = options;

    setPopup({ visible: true, content, autoHide });

    if (timerRef.current) clearTimeout(timerRef.current);

    if (autoHide) {
      timerRef.current = setTimeout(() => {
        hidePopup();
      }, 2500);
    }
  };

  // ---------------- HIDE POPUP ----------------
  const hidePopup = () => {
    setPopup({ visible: false, content: null, autoHide: true });
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // ---------------- CLICK OUTSIDE ----------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        popup.visible &&
        !popup.autoHide &&
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        hidePopup();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popup.visible, popup.autoHide]);

  // ---------------- POPUP STYLE ----------------
  const popupStyle = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) scale(1)",
    background: theme === "dark" ? "rgba(18,18,18,0.96)" : "#ffffff",
    color: theme === "dark" ? "#ffffff" : "#000000",
    borderRadius: 14,
    boxShadow:
      theme === "dark"
        ? "0 10px 40px rgba(0,0,0,0.6)"
        : "0 10px 40px rgba(0,0,0,0.2)",
    zIndex: 99999,
    minWidth: 180,
    maxWidth: 320,
    padding: 14,
    border: theme === "dark" ? "1px solid #333" : "1px solid #eee",
    backdropFilter: "blur(8px)",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    opacity: popup.visible ? 1 : 0,
    pointerEvents: popup.visible ? "auto" : "none",
  };

  return (
    <PopupContext.Provider value={{ popup, showPopup, hidePopup }}>
      {children}
      <div ref={popupRef} style={popupStyle}>
        {popup.content}
      </div>
    </PopupContext.Provider>
  );
};

export default PopupContext;