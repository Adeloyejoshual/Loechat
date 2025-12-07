import React from "react";
import { useUserSettings } from "../../hooks/useUserSettings";

const PrivacyAndSecuritySettings = ({ userId }) => {
  const [settings] = useUserSettings(userId);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Privacy & Security Settings</h2>
      <div className="flex flex-col space-y-3">
        <button
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          onClick={() => alert("Blocked users: " + settings.blockedUsers.join(", "))}
        >
          Manage Blocked Users
        </button>
      </div>
    </div>
  );
};

export default PrivacyAndSecuritySettings;