// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
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

/* ---------------- Reusable BottomSheet ---------------- */
function BottomSheet({ open, onClose, children, maxHeight = "60vh", closeLabel = "Close" }) {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      dragging.current = true;
      startY.current = e.touches[0].clientY;
      el.style.transition = "";
    };
    const onTouchMove = (e) => {
      if (!dragging.current) return;
      currentY.current = e.touches[0].clientY - startY.current;
      if (currentY.current > 0) el.style.transform = `translateY(${currentY.current}px)`;
    };
    const onTouchEnd = () => {
      if (!dragging.current) return;
      dragging.current = false;
      el.style.transition = "transform 220ms ease";
      if (currentY.current > 120) onClose();
      else el.style.transform = "";
      currentY.current = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl p-4 shadow-2xl z-10"
        style={{ maxHeight }}
      >
        <div className="w-full flex justify-center mb-3">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>
        <div className="overflow-auto" style={{ maxHeight }}>
          {children}
        </div>
        <div className="mt-3">
          <button
            className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
            onClick={onClose}
            aria-label={closeLabel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Main Page Component ---------------- */
export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSmallImage, setShowSmallImage] = useState(false);

  const [sheetActionOpen, setSheetActionOpen] = useState(false);
  const [sheetReportOpen, setSheetReportOpen] = useState(false);
  const [sheetBlockOpen, setSheetBlockOpen] = useState(false);
  const [sheetMuteOpen, setSheetMuteOpen] = useState(false);
  const [sheetCallOpen, setSheetCallOpen] = useState(false);
  const [sheetMediaOpen, setSheetMediaOpen] = useState(false);

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
      } else setFriend(null);
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
    setSheetBlockOpen(false);
  };

  const toggleMute = async () => {
    await updateDoc(doc(db, "users", uid), { muted: !isMuted });
    setIsMuted(!isMuted);
    setSheetMuteOpen(false);
  };

  const downloadImage = () => {
    if (!friend?.profilePic) return;
    const link = document.createElement("a");
    link.href = friend.profilePic;
    link.download = `${friend.name || "profile"}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    setSheetReportOpen(false);
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
        {/* Profile Picture */}
        <div
          className={styles.profileWrapper}
          onClick={() => friend.profilePic && setShowSmallImage(!showSmallImage)}
        >
          {friend.profilePic ? (
            <img
              src={friend.profilePic}
              className={styles.profileImage}
              alt="Profile"
            />
          ) : (
            <div className={styles.profilePlaceholder}>
              {getInitials(friend.name)}
            </div>
          )}
        </div>

        {/* Small popup image */}
        {showSmallImage && friend.profilePic && (
          <div className={styles.smallImageOverlay} onClick={() => setShowSmallImage(false)}>
            <img
              src={friend.profilePic}
              alt="Small preview"
              className={styles.smallImagePopup}
            />
          </div>
        )}

        {/* Name & Status */}
        <div className={styles.nameWrapper}>
          <h3 className={styles.name}>{friend.name}</h3>
          <p className={styles.status}>{formatLastSeen(friend.lastSeen)}</p>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGrid}>
          <button onClick={() => setSheetActionOpen(true)} className={styles.button}>
            <FiMessageCircle /> Message
          </button>
          <button onClick={() => setSheetCallOpen(true)} className={styles.button}>
            <FiPhone /> Call
          </button>
          <button onClick={() => setSheetCallOpen(true)} className={styles.button}>
            <FiVideo /> Video
          </button>
          <button onClick={() => setSheetMediaOpen(true)} className={styles.button}>
            <FiImage /> Media
          </button>
          <button onClick={downloadImage} className={styles.button}>
            <FiDownload /> Download
          </button>
          <button onClick={() => setSheetMuteOpen(true)} className={styles.button}>
            {isMuted ? <FiBellOff /> : <FiBell />} {isMuted ? "Muted" : "Notify"}
          </button>
          <button onClick={() => setSheetReportOpen(true)} className={styles.button}>
            <FiFlag /> Report
          </button>
          <button onClick={() => setSheetBlockOpen(true)} className={styles.blockButton}>
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* BottomSheets */}
      {/* Action Sheet */}
      <BottomSheet open={sheetActionOpen} onClose={() => setSheetActionOpen(false)}>
        <button className="w-full text-left py-3 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3" onClick={() => { sendMessage(); setSheetActionOpen(false); }}>
          <FiMessageCircle /> Message
        </button>
        <button className="w-full text-left py-3 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3" onClick={() => { viewSharedMedia(); setSheetActionOpen(false); }}>
          <FiImage /> View shared media
        </button>
        <button className="w-full text-left py-3 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3" onClick={() => { downloadImage(); setSheetActionOpen(false); }}>
          <FiDownload /> Download profile picture
        </button>
      </BottomSheet>

      {/* Other sheets (Call, Media, Mute, Block, Report) */}
      {/* ...You can keep the previous BottomSheet code for Call, Media, Mute, Block, Report here as before... */}
    </div>
  );
}

/* ---------------- Styles ---------------- */
const styles = {
  page: "min-h-screen p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex justify-center",
  card: "w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6",

  profileWrapper: "w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 cursor-pointer mx-auto mb-4 relative",
  profileImage: "w-full h-full object-cover",
  profilePlaceholder: "w-full h-full bg-gray-500 flex items-center justify-center text-white text-2xl font-bold",

  smallImageOverlay: "fixed inset-0 flex items-center justify-center bg-black/30 z-40",
  smallImagePopup: "w-24 h-24 rounded-full shadow-lg border border-gray-300 dark:border-gray-600",

  nameWrapper: "text-center mb-6",
  name: "text-xl font-semibold text-gray-900 dark:text-gray-100",
  status: "text-sm text-gray-500 dark:text-gray-400 mt-1",

  buttonGrid: "grid grid-cols-3 gap-3",
  button: "flex flex-col items-center justify-center py-3 px-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition transform hover:scale-105 shadow-sm text-xs gap-1",
  blockButton: "col-span-3 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105 mt-2 shadow-sm text-sm",

  loadingContainer: "min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400",
};