import React from "react";
import { useTheme } from "../../hooks/useTheme"; // optional theme hook

const SupportAndAboutSettings = () => {
  const { theme } = useTheme();

  const openMail = () => {
    window.open("mailto:loechatapp@gmail.com");
  };

  const openLink = (url) => {
    window.open(url, "_blank");
  };

  return (
    <div
      className={`p-4 rounded-lg shadow-md ${
        theme === "dark" ? "bg-[#1f1f1f] text-gray-200" : "bg-white text-gray-800"
      }`}
    >
      <h2 className="text-xl font-semibold mb-4">Support & About Settings</h2>
      <div className="flex flex-col space-y-3">
        <button
          className={`px-4 py-2 rounded-lg transition ${
            theme === "dark"
              ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
              : "bg-gray-100 hover:bg-gray-200 text-gray-800"
          }`}
          onClick={() => openLink("https://yourapp.com/help")}
        >
          Help Center
        </button>

        <button
          className={`px-4 py-2 rounded-lg transition ${
            theme === "dark"
              ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
              : "bg-gray-100 hover:bg-gray-200 text-gray-800"
          }`}
          onClick={openMail}
        >
          Contact Support
        </button>

        <button
          className={`px-4 py-2 rounded-lg transition ${
            theme === "dark"
              ? "bg-gray-800 hover:bg-gray-700 text-gray-200"
              : "bg-gray-100 hover:bg-gray-200 text-gray-800"
          }`}
          onClick={() => openLink("https://yourapp.com/terms")}
        >
          Terms & Privacy Policy
        </button>

        <p className="text-gray-500 text-sm mt-2">App Version: 1.0.0</p>
      </div>
    </div>
  );
};

export default SupportAndAboutSettings;