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

  const backend = "https://www.loechat.com";

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
      <div className={styles.loadingContainer}>Loading profile…</div>
    );

  if (!friend)
    return (
      <div className={styles.loadingContainer}>No user data found for uid: {uid}</div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Profile Picture */}
        <div className={styles.profileWrapper} onClick={() => setShowImage(true)}>
          {friend.profilePic ? (
            <img src={friend.profilePic} className={styles.profileImage} alt="Profile" />
          ) : (
            <div className={styles.profilePlaceholder}>{getInitials(friend.name)}</div>
          )}
        </div>

        {/* Name & Status */}
        <div className={styles.nameWrapper}>
          <h3 className={styles.name}>{friend.name}</h3>
          <p className={styles.status}>{formatLastSeen(friend.lastSeen)}</p>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGrid}>
          <button onClick={sendMessage} className={styles.button}><FiMessageCircle /> Message</button>
          <button onClick={() => alert("Call feature coming soon!")} className={styles.button}><FiPhone /> Call</button>
          <button onClick={() => alert("Video feature coming soon!")} className={styles.button}><FiVideo /> Video</button>
          <button onClick={viewSharedMedia} className={styles.button}><FiImage /> Media</button>
          <button onClick={downloadImage} className={styles.button}><FiDownload /> Download</button>
          <button onClick={toggleMute} className={styles.button}>
            {isMuted ? <FiBellOff /> : <FiBell />} {isMuted ? "Muted" : "Notify"}
          </button>
          <button onClick={() => setShowReport(true)} className={styles.button}><FiFlag /> Report</button>
          <button onClick={toggleBlock} className={styles.blockButton}><FiSlash /> {isBlocked ? "Unblock" : "Block"}</button>
        </div>
      </div>

      {/* Fullscreen Image */}
      {showImage && friend.profilePic && (
        <div className={styles.fullscreenWrapper}>
          <FiX onClick={() => setShowImage(false)} className={styles.fullscreenClose} />
          <img src={friend.profilePic} className={styles.fullscreenImage} alt="Profile Fullscreen" />
        </div>
      )}

      {/* Report Modal */}
      {showReport && (
        <div className={styles.modalWrapper}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className={styles.modalTextarea}
              placeholder="Enter reason..."
            ></textarea>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowReport(false)} className={styles.modalCancel}>Cancel</button>
              <button onClick={submitReport} className={styles.modalSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Styles ---------------- */
const styles = {
  page: "min-h-screen p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex justify-center",
  card: "w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6",

  profileWrapper: "w-16 h-16 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 cursor-pointer mx-auto mb-4",
  profileImage: "w-full h-full object-cover",
  profilePlaceholder: "w-full h-full bg-gray-500 flex items-center justify-center text-white text-xl font-bold",

  nameWrapper: "text-center mb-6",
  name: "text-lg font-semibold text-gray-900 dark:text-gray-100",
  status: "text-sm text-gray-500 dark:text-gray-400 mt-1",

  buttonGrid: "grid grid-cols-3 gap-3",
  button: "flex flex-col items-center justify-center py-3 px-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition transform hover:scale-105 shadow-sm text-xs gap-1",
  blockButton: "col-span-3 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105 mt-2 shadow-sm text-sm",

  fullscreenWrapper: "fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50",
  fullscreenClose: "absolute top-5 right-5 text-white text-4xl cursor-pointer hover:text-red-500 transition",
  fullscreenImage: "max-h-full max-w-full rounded-lg shadow-2xl animate-fadeIn",

  modalWrapper: "fixed inset-0 bg-black/70 flex items-center justify-center z-50",
  modal: "bg-white dark:bg-gray-800 p-6 rounded-lg w-80 shadow-lg",
  modalTitle: "font-semibold mb-3 text-gray-900 dark:text-gray-100",
  modalTextarea: "w-full border p-2 rounded mb-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400",
  modalButtons: "flex justify-end gap-2",
  modalCancel: "px-3 py-1 rounded border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition",
  modalSubmit: "px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition",

  loadingContainer: "min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400",
};