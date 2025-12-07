// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import {
  FiMessageCircle,
  FiVideo,
  FiPhone,
  FiImage,
  FiSlash,
  FiBell,
  FiBellOff,
  FiX,
  FiDownload,
  FiFlag,
} from "react-icons/fi";

/* ---------------- Utilities ---------------- */
const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Offline";
  const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - last.getTime();

  if (diff < 60000) return "Online";
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const backend = "https://www.loechat.com"; // Updated backend

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setFriend({ id: snap.id, ...snap.data() });
        setIsBlocked(snap.data().blocked || false);
        setIsMuted(snap.data().muted || false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const sendMessage = () => {
    const chatId = [currentUser.uid, uid].sort().join("_");
    navigate(`/chat/${chatId}`);
  };

  const viewSharedMedia = () => {
    const chatId = [currentUser.uid, uid].sort().join("_");
    navigate(`/chat/${chatId}/media`);
  };

  const toggleBlock = async () => {
    await updateDoc(doc(db, "users", uid), { blocked: !isBlocked });
    setIsBlocked(!isBlocked);
  };

  const toggleMute = async () => {
    await updateDoc(doc(db, "users", uid), { muted: !isMuted });
    setIsMuted(!isMuted);
  };

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = friend.profilePic;
    link.download = `${friend.name || "profile"}.jpg`;
    link.click();
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return alert("Enter report reason");

    await fetch(`${backend}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reporterId: currentUser.uid,
        reportedId: uid,
        reason: reportReason,
      }),
    });

    setShowReport(false);
    setReportReason("");
    alert("✅ Report submitted secretly");
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
        Loading profile…
      </div>
    );

  if (!friend)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">
        No user data found for uid: {uid}
      </div>
    );

  return (
    <div className={`min-h-screen p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300`}>
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">

        {/* Profile Picture */}
        <div className="flex justify-center mb-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 cursor-pointer transition-transform hover:scale-105"
            onClick={() => setShowImage(true)}
          >
            {friend.profilePic ? (
              <img
                src={friend.profilePic}
                className="w-full h-full object-cover"
                alt="Profile"
              />
            ) : (
              <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white text-2xl font-bold">
                {getInitials(friend.name)}
              </div>
            )}
          </div>
        </div>

        {/* Name & Status */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{friend.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatLastSeen(friend.lastSeen)}
          </p>
        </div>

        {/* Buttons Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { action: sendMessage, label: "Message", icon: <FiMessageCircle /> },
            { action: () => alert("Call feature coming soon!"), label: "Call", icon: <FiPhone /> },
            { action: () => alert("Video feature coming soon!"), label: "Video", icon: <FiVideo /> },
            { action: viewSharedMedia, label: "Media", icon: <FiImage /> },
            { action: downloadImage, label: "Download", icon: <FiDownload /> },
            { action: toggleMute, label: isMuted ? "Muted" : "Notify", icon: isMuted ? <FiBellOff /> : <FiBell /> },
            { action: () => setShowReport(true), label: "Report", icon: <FiFlag /> },
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={btn.action}
              className="flex flex-col items-center justify-center py-3 px-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition transform hover:scale-105"
              title={btn.label}
            >
              {btn.icon}
              <span className="text-xs mt-1">{btn.label}</span>
            </button>
          ))}

          {/* Block button spans full row */}
          <button
            onClick={toggleBlock}
            className="col-span-3 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105 mt-2"
          >
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* Fullscreen Image */}
      {showImage && friend.profilePic && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <FiX
            onClick={() => setShowImage(false)}
            className="absolute top-5 right-5 text-white text-3xl cursor-pointer"
          />
          <img
            src={friend.profilePic}
            className="max-h-full max-w-full rounded-lg"
            alt="Profile Fullscreen"
          />
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-80 shadow-lg">
            <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full border p-2 rounded mb-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter reason..."
            ></textarea>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReport(false)}
                className="px-3 py-1 rounded border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}