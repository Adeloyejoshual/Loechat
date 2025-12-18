import React, { useState } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useTheme } from "../../hooks/useTheme"; // optional theme hook

const PrivacyAndSecuritySettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const { theme } = useTheme(); // optional

  const [loadingUser, setLoadingUser] = useState(null);

  const toggleBlockUser = async (userIdToBlock) => {
    setLoadingUser(userIdToBlock);
    try {
      const isBlocked = settings.blockedUsers.includes(userIdToBlock);
      const updatedBlocked = isBlocked
        ? settings.blockedUsers.filter((u) => u !== userIdToBlock)
        : [...settings.blockedUsers, userIdToBlock];

      await updateSetting("blockedUsers", updatedBlocked);

      showPopup(
        isBlocked
          ? `✅ User ${userIdToBlock} unblocked`
          : `⛔ User ${userIdToBlock} blocked`
      );
    } catch (err) {
      console.error(err);
      showPopup("⚠️ Failed to update blocked users.");
    } finally {
      setLoadingUser(null);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg shadow-md ${
        theme === "dark" ? "bg-[#1f1f1f] text-gray-200" : "bg-white text-gray-800"
      }`}
    >
      <h2 className="text-xl font-semibold mb-4">Privacy & Security Settings</h2>
      <div className="flex flex-col space-y-3">
        {settings.blockedUsers.length === 0 && (
          <p className="text-gray-500">No blocked users</p>
        )}

        {settings.blockedUsers.map((user, idx) => (
          <div
            key={idx}
            className={`flex justify-between items-center p-3 rounded-lg transition ${
              theme === "dark" ? "bg-gray-800" : "bg-gray-50"
            }`}
          >
            <span>{user}</span>
            <button
              className={`px-3 py-1 rounded-lg font-medium transition ${
                theme === "dark"
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
  );
};

export default PrivacyAndSecuritySettings;