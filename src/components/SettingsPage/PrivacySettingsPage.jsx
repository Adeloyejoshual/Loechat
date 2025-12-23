import React, { useState, useRef } from "react";
import { useUserSettings } from "../../hooks/useUserSettings";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

const PrivacyAndSecuritySettings = ({ userId, allUsers = [] }) => {
  const [settings, updateSetting] = useUserSettings(userId);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [swipedUser, setSwipedUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [personalInfo, setPersonalInfo] = useState(settings.personalInfo || "Everyone");
  const [readReceipts, setReadReceipts] = useState(settings.readReceipts ?? true);

  const startXRef = useRef(0);

  // =============== Swipe actions ===============
  const handleTouchStart = (e) => (startXRef.current = e.touches[0].clientX);
  const handleTouchEnd = (user, e) => {
    const deltaX = e.changedTouches[0].clientX - startXRef.current;
    if (deltaX < -50) handleDelete(user); // swipe left → delete
    else if (deltaX > 50) handleUnblock(user); // swipe right → unblock
  };

  const handleUnblock = async (user) => {
    if (!settings.blockedUsers.includes(user)) return;
    setSwipedUser(user);
    navigator.vibrate?.(50);
    setTimeout(async () => {
      try {
        const updated = settings.blockedUsers.filter((u) => u !== user);
        await updateSetting("blockedUsers", updated);
        showPopup(`✅ ${user} unblocked`);
      } catch {
        showPopup("⚠️ Failed to unblock user");
      } finally {
        setSwipedUser(null);
      }
    }, 200);
  };

  const handleDelete = async (user) => {
    if (!settings.blockedUsers.includes(user)) return;
    if (!window.confirm(`⚠️ Delete ${user} from blocked users permanently?`)) return;
    setSwipedUser(user);
    navigator.vibrate?.([80, 40, 80]);
    setTimeout(async () => {
      try {
        const updated = settings.blockedUsers.filter((u) => u !== user);
        await updateSetting("blockedUsers", updated);
        showPopup(`🗑️ ${user} removed from blocked list`);
      } catch {
        showPopup("⚠️ Failed to delete user");
      } finally {
        setSwipedUser(null);
      }
    }, 250);
  };

  const filteredUsers = allUsers.filter(
    (u) => u.toLowerCase().includes(searchTerm.toLowerCase()) && u !== userId
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ duration: 0.25 }}
        className={`p-6 min-h-screen ${isDark ? "bg-[#1c1c1c]" : "bg-gray-100"}`}
      >
        {/* Back */}
        <div
          onClick={() => navigate("/settings")}
          className={`cursor-pointer mb-4 font-bold text-lg ${isDark ? "text-white" : "text-black"}`}
        >
          ← Back to Settings
        </div>

        {/* Personal Info */}
        <div className={`p-4 mb-4 rounded-xl shadow-md ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
          <h2 className="text-xl font-semibold mb-2">Who can see my personal info?</h2>
          {["Everyone", "Contacts", "Nobody"].map((option) => (
            <label key={option} className="flex items-center gap-2 mb-1 cursor-pointer">
              <input
                type="radio"
                value={option}
                checked={personalInfo === option}
                onChange={() => {
                  setPersonalInfo(option);
                  updateSetting("personalInfo", option);
                }}
              />
              {option}
            </label>
          ))}
        </div>

        {/* Read Receipts */}
        <div className={`p-4 mb-4 rounded-xl shadow-md flex justify-between items-center ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
          <span>Read Receipts</span>
          <input
            type="checkbox"
            checked={readReceipts}
            onChange={() => {
              setReadReceipts(!readReceipts);
              updateSetting("readReceipts", !readReceipts);
            }}
          />
        </div>

        {/* Blocked Users */}
        <div className={`p-4 mb-4 rounded-xl shadow-md ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
          <h2 className="text-xl font-semibold mb-2">Blocked Users</h2>
          {settings.blockedUsers.length === 0 && <p className={isDark ? "text-gray-400" : "text-gray-500"}>No blocked users</p>}
          {settings.blockedUsers.map((user, idx) => (
            <motion.div
              key={idx}
              className={`flex justify-between items-center p-3 rounded-lg mb-2 transition-all ${
                isDark ? "bg-gray-800 hover:bg-gray-700" : "bg-gray-50 hover:bg-gray-100"
              }`}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(user, e)}
              onClick={() => handleUnblock(user)}
              animate={{ x: swipedUser === user ? (swipedUser === user ? -200 : 200) : 0, opacity: swipedUser === user ? 0 : 1 }}
              transition={{ duration: 0.25 }}
            >
              <span>{user}</span>
              <span className="text-gray-400 text-sm">{swipedUser === user ? "" : "Swipe ← to delete / → to unblock"}</span>
            </motion.div>
          ))}
        </div>

        {/* Danger Zone */}
        <div className={`p-4 rounded-xl shadow-md border-2 border-red-600 ${isDark ? "bg-[#1c1c1c]" : "bg-white"}`}>
          <h2 className="text-xl font-semibold text-red-600 mb-2">⚠️ Danger Zone</h2>
          <p className="text-gray-400 text-sm mb-2">Swipe left to delete account permanently</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PrivacyAndSecuritySettings;