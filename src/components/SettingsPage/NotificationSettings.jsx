import React, { useState } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useTheme } from "../../hooks/useTheme"; // optional theme hook

const NotificationSettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const { theme } = useTheme(); // optional

  const [loading, setLoading] = useState(false);

  const toggleNotifications = async () => {
    setLoading(true);
    try {
      await updateSetting("notifications", !settings.notifications);
      showPopup(
        `Notifications ${!settings.notifications ? "enabled ✅" : "disabled ❌"}`
      );
    } catch (err) {
      console.error(err);
      showPopup("⚠️ Failed to update notification setting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg shadow-md ${
        theme === "dark" ? "bg-[#1f1f1f] text-gray-200" : "bg-white text-gray-800"
      }`}
    >
      <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
      <div
        className={`flex items-center justify-between p-4 rounded-lg transition ${
          theme === "dark" ? "bg-gray-800" : "bg-gray-50"
        }`}
      >
        <span>Enable Notifications</span>
        <input
          type="checkbox"
          className={`w-5 h-5 accent-blue-500 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
          checked={settings.notifications}
          onChange={toggleNotifications}
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default NotificationSettings;