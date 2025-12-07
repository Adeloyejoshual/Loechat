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

/* ---------------- Main Component ---------------- */
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
  const [showSmallImage, setShowSmallImage] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const backend = "https://www.loechat.com";

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setFriend({ id: snap.id, ...snap.data() });
        setIsBlocked(!!snap.data().blocked);
        setIsMuted(!!snap.data().muted);
      } else {
        setFriend(null);
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
    if (!friend?.profilePic) return;
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
    setReportReason("");
    alert("✅ Report submitted secretly");
  };

  if (loading)
    return <div className={styles.loadingContainer}>Loading profile…</div>;

  if (!friend)
    return (
      <div className={styles.loadingContainer}>
        No user data found for uid: {uid}
      </div>
    );

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Profile Picture (Small View) */}
        <div
          className={styles.profileWrapper}
          onClick={() => friend.profilePic && setShowSmallImage(!showSmallImage)}
        >
          {friend.profilePic ? (
            <img
              src={friend.profilePic}
              alt="Profile"
              className={styles.profileImage}
            />
          ) : (
            <div className={styles.profilePlaceholder}>
              {getInitials(friend.name)}
            </div>
          )}
        </div>
        {showSmallImage && friend.profilePic && (
          <img
            src={friend.profilePic}
            alt="Small view"
            className={styles.smallImagePopup}
          />
        )}

        {/* Name & Status */}
        <div className={styles.nameWrapper}>
          <h3 className={styles.name}>{friend.name}</h3>
          <p className={styles.status}>{formatLastSeen(friend.lastSeen)}</p>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGrid}>
          <button onClick={sendMessage} className={styles.button}>
            <FiMessageCircle /> Message
          </button>
          <button onClick={() => alert("Voice call coming soon!")} className={styles.button}>
            <FiPhone /> Call
          </button>
          <button onClick={() => alert("Video call coming soon!")} className={styles.button}>
            <FiVideo /> Video
          </button>
          <button onClick={viewSharedMedia} className={styles.button}>
            <FiImage /> Media
          </button>
          <button onClick={downloadImage} className={styles.button}>
            <FiDownload /> Download
          </button>
          <button onClick={toggleMute} className={styles.button}>
            {isMuted ? <FiBellOff /> : <FiBell />} {isMuted ? "Muted" : "Notify"}
          </button>
          <button onClick={submitReport} className={styles.button}>
            <FiFlag /> Report
          </button>
          <button onClick={toggleBlock} className={styles.blockButton}>
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const styles = {
  page: "min-h-screen p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex justify-center",
  card: "w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6",

  profileWrapper:
    "w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 cursor-pointer mx-auto mb-4 relative",
  profileImage: "w-full h-full object-cover",
  profilePlaceholder:
    "w-full h-full bg-gray-500 flex items-center justify-center text-white text-2xl font-bold",
  smallImagePopup:
    "absolute top-0 left-1/2 transform -translate-x-1/2 mt-2 w-32 h-32 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600",

  nameWrapper: "text-center mb-6",
  name: "text-xl font-semibold text-gray-900 dark:text-gray-100",
  status: "text-sm text-gray-500 dark:text-gray-400 mt-1",

  buttonGrid: "grid grid-cols-3 gap-3",
  button:
    "flex flex-col items-center justify-center py-3 px-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition transform hover:scale-105 shadow-sm text-xs gap-1",
  blockButton:
    "col-span-3 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105 mt-2 shadow-sm text-sm",

  loadingContainer: "min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400",
};