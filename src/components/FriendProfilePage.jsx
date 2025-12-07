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

  const backend = "https://smart-talk-zlxe.onrender.com";

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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen p-4 bg-gray-100 dark:bg-black">
      <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-xl shadow p-5">

        {/* Profile Picture */}
        <div className="flex justify-center mb-3">
          <div className="w-24 h-24 rounded-full overflow-hidden border cursor-pointer"
            onClick={() => setShowImage(true)}>
            {friend.profilePic ? (
              <img src={friend.profilePic} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-500 flex items-center justify-center text-white text-xl">
                {getInitials(friend.name)}
              </div>
            )}
          </div>
        </div>

        {/* Name & Status */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold">{friend.name}</h3>
          <p className="text-xs text-gray-400">{formatLastSeen(friend.lastSeen)}</p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={sendMessage}><FiMessageCircle /> Message</button>
          <button><FiPhone /> Call</button>
          <button><FiVideo /> Video</button>
          <button onClick={downloadImage}><FiDownload /> Download</button>

          <button onClick={toggleMute}>
            {isMuted ? <FiBellOff /> : <FiBell />} Notifications
          </button>

          <button onClick={() => setShowReport(true)}>
            <FiFlag /> Report User
          </button>

          <button onClick={toggleBlock} className="col-span-2">
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* Fullscreen Image */}
      {showImage && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <FiX onClick={() => setShowImage(false)} className="absolute top-5 right-5 text-white text-2xl" />
          <img src={friend.profilePic} className="max-h-full max-w-full" />
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg w-80">
            <h3 className="font-bold mb-3">Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full border p-2 rounded mb-4"
              placeholder="Enter reason..."
            ></textarea>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowReport(false)}>Cancel</button>
              <button onClick={submitReport} className="bg-red-600 text-white px-3 py-1 rounded">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}