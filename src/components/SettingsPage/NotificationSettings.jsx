import React from "react";
import { useUserSettings } from "../../hooks/useUserSettings";

const NotificationSettings = ({ userId }) => {
  const [settings, updateSetting] = useUserSettings(userId);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Notification Settings</h2>
      <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
        <span className="text-gray-700">Enable Notifications</span>
        <input
          type="checkbox"
          className="w-5 h-5 accent-blue-500"
          checked={settings.notifications}
          onChange={() => updateSetting("notifications", !settings.notifications)}
        />
      </div>
    </div>
  );
};

export default NotificationSettings;