import React, { useState } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme"; // optional theme hook

const PrivacyAndSecuritySettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loadingUser, setLoadingUser] = useState(null);

  const toggleBlockUser = async (userToToggle) => {
    setLoadingUser(userToToggle);
    try {
      const isBlocked = settings.blockedUsers.includes(userToToggle);
      const updatedBlocked = isBlocked
        ? settings.blockedUsers.filter((u) => u !== userToToggle)
        : [...settings.blockedUsers, userToToggle];

      await updateSetting("blockedUsers", updatedBlocked);

      showPopup(
        isBlocked
          ? `✅ User ${userToToggle} unblocked`
          : `⛔ User ${userToToggle} blocked`
      );
    } catch (err) {
      console.error(err);
      showPopup("⚠️ Failed to update blocked users.");
    } finally {
      setLoadingUser(null);
    }
  };

  return (
    <div className={`p-6 min-h-screen ${isDark ? "bg-[#1c1c1c]" : "bg-gray-100"}`}>
      {/* Back Arrow */}
      <div
        onClick={() => navigate("/settings")}
        style={{
          cursor: "pointer",
          marginBottom: 16,
          fontSize: 20,
          fontWeight: "bold",
          color: isDark ? "#fff" : "#000",
        }}
      >
        ← Back to Settings
      </div>

      <div
        className={`p-4 rounded-lg shadow-md ${
          isDark ? "bg-[#1f1f1f] text-gray-200" : "bg-white text-gray-800"
        }`}
      >
        <h2 className="text-xl font-semibold mb-4">Privacy & Security</h2>

        <div className="flex flex-col space-y-3">
          {settings.blockedUsers.length === 0 && (
            <p className={isDark ? "text-gray-400" : "text-gray-500"}>
              No blocked users
            </p>
          )}

          {settings.blockedUsers.map((user, idx) => (
            <div
              key={idx}
              className={`flex justify-between items-center p-3 rounded-lg transition ${
                isDark ? "bg-gray-800" : "bg-gray-50"
              }`}
            >
              <span>{user}</span>
              <button
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  isDark
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
                onClick={() => toggleBlockUser(user)}
                disabled={loadingUser === user}
              >
                {loadingUser === user ? "Processing..." : "Unblock"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrivacyAndSecuritySettings;