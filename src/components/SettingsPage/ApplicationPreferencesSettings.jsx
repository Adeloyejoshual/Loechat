import React, { useContext, useEffect } from "react";
import { ThemeContext } from "../../context/ThemeContext";
import { useUserSettings } from "../../hooks/useUserSettings";

const ApplicationPreferencesSettings = ({ userId }) => {
  const { theme, setTheme } = useContext(ThemeContext);
  const [settings, updateSetting] = useUserSettings(userId);

  useEffect(() => {
    if (settings.theme && settings.theme !== theme) {
      setTheme(settings.theme);
    }
  }, [settings.theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    updateSetting("theme", newTheme);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Application Preferences Settings</h2>
      <button
        onClick={toggleTheme}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        Switch to {theme === "light" ? "Dark" : "Light"} Mode
      </button>
    </div>
  );
};

export default ApplicationPreferencesSettings;