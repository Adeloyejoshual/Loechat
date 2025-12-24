import React, { useState } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { playSound } from "../../utils/sound";

const NotificationSettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(false);

  const toggleSetting = async (key) => {
    setLoading(true);
    try {
      await updateSetting(key, !settings[key]);

      playSound("/sounds/toggle.mp3", settings.actionSound);

      showPopup(
        `${key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())} ${
          !settings[key] ? "enabled ✅" : "disabled ❌"
        }`
      );
    } catch {
      showPopup("⚠️ Failed to update setting");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen ${isDark ? "bg-[#1c1c1c]" : "bg-gray-100"}`}>
      {/* BACK */}
      <div
        onClick={() => navigate("/settings")}
        className="mb-6 text-lg font-semibold cursor-pointer"
        style={{ color: isDark ? "#fff" : "#000" }}
      >
        ← Back to Settings
      </div>

      <div
        className={`p-5 rounded-xl shadow-md ${
          isDark ? "bg-[#1f1f1f] text-white" : "bg-white text-black"
        }`}
      >
        <h2 className="text-xl font-bold mb-4">Notifications & Sounds</h2>

        {/* NOTIFICATIONS */}
        <SettingRow
          label="Enable Notifications"
          checked={settings.notifications}
          onChange={() => toggleSetting("notifications")}
          disabled={loading}
          isDark={isDark}
        />

        {/* NOTIFICATION SOUND */}
        <SettingRow
          label="Notification Sound"
          checked={settings.notificationSound}
          onChange={() => toggleSetting("notificationSound")}
          disabled={loading}
          isDark={isDark}
        />

        {/* ACTION SOUND */}
        <SettingRow
          label="Action Sound (clicks & swipe)"
          checked={settings.actionSound}
          onChange={() => toggleSetting("actionSound")}
          disabled={loading}
          isDark={isDark}
        />
      </div>
    </div>
  );
};

const SettingRow = ({ label, checked, onChange, disabled, isDark }) => (
  <div
    className={`flex justify-between items-center p-4 rounded-lg mb-3 ${
      isDark ? "bg-gray-800" : "bg-gray-50"
    }`}
  >
    <span>{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="w-5 h-5 accent-blue-500"
    />
  </div>
);

export default NotificationSettings;