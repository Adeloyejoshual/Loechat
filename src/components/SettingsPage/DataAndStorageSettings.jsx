import React, { useState } from "react";
import { db } from "../../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme"; // optional

const DataAndStorageSettings = ({ userId }) => {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const [loadingCache, setLoadingCache] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const { theme } = useTheme(); // optional theme hook
  const isDark = theme === "dark";

  const clearCache = () => {
    setLoadingCache(true);
    try {
      localStorage.clear();
      showPopup("✅ Cache cleared successfully!");
    } catch (err) {
      console.error("Failed to clear cache:", err);
      showPopup("⚠️ Failed to clear cache");
    } finally {
      setLoadingCache(false);
    }
  };

  const downloadData = async () => {
    setLoadingDownload(true);
    try {
      const docSnap = await getDoc(doc(db, "users", userId));
      if (!docSnap.exists()) throw new Error("User data not found.");

      const data = docSnap.data();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "user_data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showPopup("✅ Data downloaded successfully!");
    } catch (err) {
      console.error("Download failed:", err);
      showPopup("⚠️ Failed to download data.");
    } finally {
      setLoadingDownload(false);
    }
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

      <div className={`p-4 rounded-lg shadow-md ${isDark ? "bg-[#1f1f1f] text-gray-200" : "bg-white text-gray-800"}`}>
        <h2 className="text-xl font-semibold mb-4">Data & Storage Settings</h2>

        <div className="flex flex-col space-y-3">
          <button
            className={`px-4 py-2 rounded-lg transition ${
              isDark ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-800"
            } ${loadingCache ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={clearCache}
            disabled={loadingCache}
          >
            {loadingCache ? "Clearing..." : "Clear Cache"}
          </button>

          <button
            className={`px-4 py-2 rounded-lg transition ${
              isDark ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"
            } ${loadingDownload ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={downloadData}
            disabled={loadingDownload}
          >
            {loadingDownload ? "Downloading..." : "Download Data"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataAndStorageSettings;