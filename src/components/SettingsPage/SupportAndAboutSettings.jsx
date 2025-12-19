import React from "react";
import { useTheme } from "../../hooks/useTheme"; // optional theme hook
import { useNavigate } from "react-router-dom";

const SupportAndAboutSettings = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const openMail = () => {
    window.open("mailto:loechatapp@gmail.com");
  };

  const openLink = (url) => {
    window.open(url, "_blank");
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
        <h2 className="text-xl font-semibold mb-4">Support & About</h2>

        <div className="flex flex-col space-y-3">
          <button
            className={`px-4 py-2 rounded-lg transition ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
            onClick={() => openLink("https://yourapp.com/help")}
          >
            Help Center
          </button>

          <button
            className={`px-4 py-2 rounded-lg transition ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
            onClick={openMail}
          >
            Contact Support
          </button>

          <button
            className={`px-4 py-2 rounded-lg transition ${
              isDark
                ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
                : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            }`}
            onClick={() => openLink("https://yourapp.com/terms")}
          >
            Terms & Privacy Policy
          </button>

          <p className={isDark ? "text-gray-400 text-sm mt-2" : "text-gray-500 text-sm mt-2"}>
            App Version: 1.0.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupportAndAboutSettings;