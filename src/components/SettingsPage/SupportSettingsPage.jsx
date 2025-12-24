import React, { useRef, useEffect, useState } from "react";
import { useTheme } from "../../hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "../../utils/sound";

const SupportAndAboutSettings = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const containerRef = useRef(null);
  const startX = useRef(0);
  const endX = useRef(0);

  const [isExiting, setIsExiting] = useState(false);

  /* ---------------- SWIPE RIGHT TO GO BACK ---------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e) => (startX.current = e.touches[0].clientX);
    const onMove = (e) => (endX.current = e.touches[0].clientX);
    const onEnd = () => {
      if (endX.current - startX.current > 90) triggerBack();
    };

    el.addEventListener("touchstart", onStart);
    el.addEventListener("touchmove", onMove);
    el.addEventListener("touchend", onEnd);

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  const triggerBack = () => {
    playSound("/sounds/toggle.mp3", true);
    setIsExiting(true);
    setTimeout(() => navigate("/settings"), 220);
  };

  const openMail = () => {
    playSound("/sounds/success.mp3", true);
    window.open("mailto:loechatapp@gmail.com");
  };

  const openLink = (url) => {
    playSound("/sounds/toggle.mp3", true);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          ref={containerRef}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`min-h-screen p-6 ${
            isDark ? "bg-[#1c1c1c] text-white" : "bg-gray-100 text-black"
          }`}
        >
          {/* BACK */}
          <div
            onClick={triggerBack}
            className="mb-6 text-lg font-semibold cursor-pointer"
          >
            ← Back to Settings
          </div>

          {/* SUPPORT */}
          <Section title="Support">
            <ActionButton
              label="Help Center"
              onClick={() => openLink("https://yourapp.com/help")}
              isDark={isDark}
            />
            <ActionButton
              label="Contact Support"
              onClick={openMail}
              isDark={isDark}
            />
          </Section>

          {/* LEGAL */}
          <Section title="Legal">
            <ActionButton
              label="Terms of Service"
              onClick={() => openLink("https://yourapp.com/terms")}
              isDark={isDark}
            />
            <ActionButton
              label="Privacy Policy"
              onClick={() => openLink("https://yourapp.com/privacy")}
              isDark={isDark}
            />
          </Section>

          {/* ABOUT */}
          <Section title="About">
            <div className="text-sm opacity-70 leading-relaxed">
              LoeChat is a secure real-time messaging platform focused on privacy,
              speed, and modern communication.
            </div>

            <div className="mt-4 text-xs opacity-50">
              Version 1.0.0 • © {new Date().getFullYear()} LoeChat
            </div>
          </Section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ---------------- REUSABLE COMPONENTS ---------------- */

const Section = ({ title, children }) => (
  <div className="mb-6 p-5 rounded-xl shadow-md bg-white/5">
    <h2 className="text-lg font-bold mb-4">{title}</h2>
    <div className="space-y-3">{children}</div>
  </div>
);

const ActionButton = ({ label, onClick, isDark }) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-3 rounded-lg font-medium transition ${
      isDark
        ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
        : "bg-gray-100 hover:bg-gray-200 text-gray-800"
    }`}
  >
    {label}
  </button>
);

export default SupportAndAboutSettings;