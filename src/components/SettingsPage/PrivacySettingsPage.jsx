
import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { usePopup } from "../../context/PopupContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

export default function PrivacyAndSecuritySettings({ userId }) {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [settings, setSettings] = useState({
    blockedUsers: [],
    personalInfo: "Everyone",
    readReceipts: true,
  });
  const [loadingUser, setLoadingUser] = useState(null);
  const [swipedUser, setSwipedUser] = useState(null);

  const containerRef = useRef(null);
  const startX = useRef(0);
  const endX = useRef(0);

  // ================== LIVE FIREBASE SYNC ==================
  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return unsub;
  }, [userId]);

  // ================== SWIPE HANDLER ==================
  const handleTouchStart = (e) => (startX.current = e.touches[0].clientX);
  const handleTouchMove = (e) => (endX.current = e.touches[0].clientX);
  const handleTouchEnd = (user) => {
    const deltaX = endX.current - startX.current;
    if (deltaX < -80) handleDeleteUser(user); // swipe left → delete
    if (deltaX > 80) handleUnblock(user); // swipe right → unblock
  };

  // ================== BLOCKED USERS ACTIONS ==================
  const handleUnblock = async (user) => {
    setLoadingUser(user);
    try {
      const updated = settings.blockedUsers.filter((u) => u !== user);
      await updateDoc(doc(db, "users", userId), { blockedUsers: updated });
      showPopup(`✅ ${user} unblocked`);
    } catch {
      showPopup("⚠️ Failed to unblock user");
    } finally {
      setLoadingUser(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`⚠️ Permanently remove ${user} from blocked list?`)) return;
    setLoadingUser(user);
    try {
      const updated = settings.blockedUsers.filter((u) => u !== user);
      await updateDoc(doc(db, "users", userId), { blockedUsers: updated });
      showPopup(`🗑️ ${user} deleted from blocked list`);
    } catch {
      showPopup("⚠️ Failed to delete user");
    } finally {
      setLoadingUser(null);
    }
  };

  // ================== PRIVACY SETTINGS ==================
  const updatePersonalInfo = async (value) => {
    try {
      await updateDoc(doc(db, "users", userId), { personalInfo: value });
      showPopup(`✅ Personal info visible to ${value}`);
    } catch {
      showPopup("⚠️ Failed to update privacy setting");
    }
  };

  const toggleReadReceipts = async () => {
    try {
      await updateDoc(doc(db, "users", userId), { readReceipts: !settings.readReceipts });
      showPopup(`✅ Read receipts ${!settings.readReceipts ? "enabled" : "disabled"}`);
    } catch {
      showPopup("⚠️ Failed to toggle read receipts");
    }
  };

  return (
    <div
      ref={containerRef}
      className={`p-6 min-h-screen ${isDark ? "bg-[#1c1c1c] text-gray-100" : "bg-gray-100 text-gray-800"}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Back */}
      <div
        onClick={() => navigate("/settings")}
        className="cursor-pointer mb-4 text-lg font-bold"
      >
        ← Back to Settings
      </div>

      {/* ===== Privacy Section (Pinned Top) ===== */}
      <div className={`p-4 rounded-lg mb-6 shadow-md ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
        <h2 className="text-xl font-semibold mb-4">🔒 Privacy</h2>
        <div className="mb-4">
          <label className="block font-medium mb-1">Who can see my personal info?</label>
          <select
            value={settings.personalInfo}
            onChange={(e) => updatePersonalInfo(e.target.value)}
            className={`w-full p-2 rounded ${isDark ? "bg-gray-800 text-gray-100" : "bg-gray-100"}`}
          >
            <option>Everyone</option>
            <option>Friends</option>
            <option>Only Me</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.readReceipts}
            onChange={toggleReadReceipts}
          />
          <span>Enable Read Receipts</span>
        </div>
      </div>

      {/* ===== Blocked Users Section ===== */}
      <div className={`p-4 rounded-lg shadow-md ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
        <h2 className="text-xl font-semibold mb-4">⛔ Blocked Users</h2>
        <AnimatePresence>
          {settings.blockedUsers.length === 0 && (
            <p className={isDark ? "text-gray-400" : "text-gray-500"}>No blocked users</p>
          )}
          {settings.blockedUsers.map((user, idx) => (
            <motion.div
              key={idx}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -200, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex justify-between items-center p-3 mb-2 rounded-lg cursor-pointer select-none ${
                isDark ? "bg-gray-800 text-gray-100" : "bg-gray-50 text-gray-800"
              }`}
              onTouchEnd={() => handleTouchEnd(user)}
            >
              <span>{user}</span>
              <button
                onClick={() => handleUnblock(user)}
                disabled={loadingUser === user}
                className={`px-3 py-1 rounded font-medium ${
                  isDark ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {loadingUser === user ? "Processing..." : "Unblock"}
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}