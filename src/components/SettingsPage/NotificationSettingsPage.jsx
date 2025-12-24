import React, { useState, useEffect, useRef } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationSettings({ userId }) {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef(null);
  const startX = useRef(0);
  const endX = useRef(0);

  // ================= SWIPE BACK =================
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const start = (e) => (startX.current = e.touches[0].clientX);
    const move = (e) => (endX.current = e.touches[0].clientX);
    const end = () => {
      if (endX.current - startX.current > 90) goBack();
    };

    el.addEventListener("touchstart", start);
    el.addEventListener("touchmove", move);
    el.addEventListener("touchend", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, []);

  const goBack = () => {
    setIsExiting(true);
    setTimeout(() => navigate("/settings"), 280);
  };

  // ================= TOGGLES =================
  const toggle = (key, value) =>
    updateSetting(key, typeof value === "boolean" ? value : !settings[key]);

  // ================= VIBRATION TEST =================
  const testVibration = () => {
    if (!("vibrate" in navigator)) {
      return showPopup("❌ Vibration not supported");
    }
    navigator.vibrate([200, 100, 200]);
    showPopup("📳 Vibration test");
  };

  if (!settings) return null;

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          ref={containerRef}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.25 }}
          className={`min-h-screen p-6 ${
            isDark ? "bg-[#1c1c1c] text-white" : "bg-gray-100 text-gray-900"
          }`}
        >
          {/* BACK */}
          <div onClick={goBack} className="font-bold text-lg mb-6 cursor-pointer">
            ← Back to Settings
          </div>

          {/* QUIET HOURS */}
          <Section title="🌙 Quiet Hours">
            <Row
              label="Enable Do Not Disturb"
              checked={settings.quietHours?.enabled}
              onChange={() =>
                updateSetting("quietHours", {
                  ...settings.quietHours,
                  enabled: !settings.quietHours?.enabled,
                })
              }
              isDark={isDark}
            />

            {settings.quietHours?.enabled && (
              <div className="flex gap-3 mt-3">
                <input
                  type="time"
                  value={settings.quietHours.start}
                  onChange={(e) =>
                    updateSetting("quietHours", {
                      ...settings.quietHours,
                      start: e.target.value,
                    })
                  }
                  className={timeInput(isDark)}
                />
                <input
                  type="time"
                  value={settings.quietHours.end}
                  onChange={(e) =>
                    updateSetting("quietHours", {
                      ...settings.quietHours,
                      end: e.target.value,
                    })
                  }
                  className={timeInput(isDark)}
                />
              </div>
            )}
          </Section>

          {/* CHAT OVERRIDES */}
          <Section title="💬 Chat Notifications">
            {Object.entries(settings.chatOverrides || {}).length === 0 && (
              <p className="opacity-60">No custom chat settings</p>
            )}

            {Object.entries(settings.chatOverrides || {}).map(
              ([chatId, cfg]) => (
                <div key={chatId} className={chatRow(isDark)}>
                  <span>Chat {chatId.slice(0, 6)}</span>
                  <button
                    onClick={() =>
                      updateSetting("chatOverrides", {
                        ...settings.chatOverrides,
                        [chatId]: { mute: !cfg.mute },
                      })
                    }
                    className="text-sm text-red-500"
                  >
                    {cfg.mute ? "Unmute" : "Mute"}
                  </button>
                </div>
              )
            )}
          </Section>

          {/* VIBRATION */}
          <Section title="📳 Vibration">
            <Row
              label="Enable Vibration"
              checked={settings.vibration}
              onChange={() => toggle("vibration")}
              isDark={isDark}
            />
            <button onClick={testVibration} className={testBtn(isDark)}>
              Test Vibration
            </button>
          </Section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================= UI HELPERS =================
const Section = ({ title, children }) => (
  <div className="mb-6 bg-white/90 dark:bg-[#1f1f1f] p-4 rounded-xl shadow">
    <h2 className="font-semibold text-lg mb-3">{title}</h2>
    {children}
  </div>
);

const Row = ({ label, checked, onChange, isDark }) => (
  <div
    className={`flex justify-between items-center p-3 rounded-lg ${
      isDark ? "bg-gray-800" : "bg-gray-50"
    }`}
  >
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-5 h-5 accent-blue-500"
    />
  </div>
);

const chatRow = (isDark) =>
  `flex justify-between items-center p-3 mb-2 rounded-lg ${
    isDark ? "bg-gray-800" : "bg-gray-50"
  }`;

const timeInput = (isDark) =>
  `w-full p-2 rounded-lg ${
    isDark ? "bg-gray-800 text-white" : "bg-gray-50"
  }`;

const testBtn = (isDark) =>
  `mt-3 w-full p-3 rounded-lg font-bold ${
    isDark ? "bg-blue-600" : "bg-blue-500 text-white"
  }`;