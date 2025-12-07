import React from "react";
import { useUserSettings } from "../../hooks/useUserSettings";

const PrivacyAndSecuritySettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);

  const toggleBlockUser = (userIdToBlock) => {
    const updatedBlocked = settings.blockedUsers.includes(userIdToBlock)
      ? settings.blockedUsers.filter((u) => u !== userIdToBlock)
      : [...settings.blockedUsers, userIdToBlock];
    updateSetting("blockedUsers", updatedBlocked);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Privacy & Security Settings</h2>
      <div className="flex flex-col space-y-3">
        {settings.blockedUsers.map((user, idx) => (
          <div key={idx} className="flex justify-between bg-gray-50 p-2 rounded-lg">
            <span>{user}</span>
            <button
              className="text-red-500 hover:text-red-700"
              onClick={() => toggleBlockUser(user)}
            >
              Unblock
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrivacyAndSecuritySettings;