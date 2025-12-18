import React, { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";

const ApplicationPreferencesSettings = ({ userId }) => {
  const { theme, updateSettings } = useContext(ThemeContext);
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const [localTheme, setLocalTheme] = useState(theme || "light");
  const [loading, setLoading] = useState(false);

  // Sync local theme with global context
  useEffect(() => {
    if (settings.theme && settings.theme !== localTheme) {
      setLocalTheme(settings.theme);
    }
  }, [settings.theme]);

  const toggleTheme = async () => {
    setLoading(true);
    const newTheme = localTheme === "light" ? "dark" : "light";

    try {
      setLocalTheme(newTheme);
      updateSettings(newTheme, settings.wallpaper || ""); // Update global context
      await updateSetting("theme", newTheme); // Persist to Firestore
      showPopup(`Theme switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode`);
    } catch (err) {
      console.error("Failed to update theme:", err);
      showPopup("Error switching theme. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white dark:bg-[#1f1f1f] rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
        Application Preferences
      </h2>

      {/* Theme Toggle */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-700 dark:text-gray-300">App Theme</span>
        <button
          onClick={toggleTheme}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            localTheme === "light"
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-700 text-white hover:bg-gray-800"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Switching..." : `Switch to ${localTheme === "light" ? "Dark" : "Light"}`}
        </button>
      </div>

      {/* Future Preferences Placeholder */}
      <div className="text-gray-500 dark:text-gray-400 text-sm">
        More application preferences can be added here, like:
        <ul className="list-disc list-inside mt-1">
          <li>Language</li>
          <li>Font size</li>
          <li>Animations</li>
        </ul>
      </div>
    </div>
  );
};

export default ApplicationPreferencesSettings;