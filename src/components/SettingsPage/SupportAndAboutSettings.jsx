import React from "react";

const SupportAndAboutSettings = () => {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Support & About Settings</h2>
      <div className="flex flex-col space-y-3">
        <button
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          onClick={() => window.open("https://yourapp.com/help", "_blank")}
        >
          Help Center
        </button>
        <button
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          onClick={() => window.open("mailto:support@yourapp.com")}
        >
          Contact Support
        </button>
        <button
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          onClick={() => window.open("https://yourapp.com/terms", "_blank")}
        >
          Terms & Privacy Policy
        </button>
        <p className="text-gray-500 text-sm mt-2">App Version: 1.0.0</p>
      </div>
    </div>
  );
};

export default SupportAndAboutSettings;