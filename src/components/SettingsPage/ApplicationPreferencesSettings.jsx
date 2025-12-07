import React, { useContext } from "react";
import { ThemeContext } from "../../context/ThemeContext";

const ApplicationPreferencesSettings = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

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