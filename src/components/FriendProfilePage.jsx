// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
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

  // prevent background scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    function onTouchStart(e) {
      dragging.current = true;
      startY.current = e.touches[0].clientY;
      el.style.transition = "";
    }
    function onTouchMove(e) {
      if (!dragging.current) return;
      currentY.current = e.touches[0].clientY - startY.current;
      if (currentY.current > 0) {
        el.style.transform = `translateY(${currentY.current}px)`;
      }
    }
    function onTouchEnd() {
      if (!dragging.current) return;
      dragging.current = false;
      el.style.transition = "transform 220ms ease";
      if (currentY.current > 120) {
        onClose();
      } else {
        el.style.transform = "";
      }
      currentY.current = 0;
    }

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
      aria-hidden={!open}
      onMouseDown={(e) => {
        // close if clicking backdrop
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl p-4 shadow-2xl z-10"
        style={{ maxHeight, transform: "translateY(0)", width: "100%" }}
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

/* ---------------- Fullscreen Image Viewer with Swipe Down ---------------- */
function FullscreenImageViewer({ src, onClose }) {
  const viewerRef = useRef(null);
  const startY = useRef(0);
  const curY = useRef(0);
  const dragging = useRef(false);
  const [scale, setScale] = useState(1);
  const lastTouchDist = useRef(null);

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    function onTouchStart(e) {
      if (e.touches.length === 1) {
        dragging.current = true;
        startY.current = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // pinch start
        const a = e.touches[0];
        const b = e.touches[1];
        lastTouchDist.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 1 && dragging.current) {
        curY.current = e.touches[0].clientY - startY.current;
        if (curY.current > 0) {
          el.style.transform = `translateY(${curY.current}px)`;
          el.style.opacity = `${Math.max(0.4, 1 - curY.current / 800)}`;
        }
      } else if (e.touches.length === 2 && lastTouchDist.current) {
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = dist / lastTouchDist.current;
        const nextScale = Math.min(3, Math.max(0.5, scale * ratio));
        setScale(nextScale);
        lastTouchDist.current = dist;
      }
    }
    function onTouchEnd(e) {
      if (dragging.current) {
        dragging.current = false;
        if (curY.current > 120) {
          onClose();
        } else {
          el.style.transition = "transform 180ms ease, opacity 180ms ease";
          el.style.transform = "";
          el.style.opacity = "";
          setTimeout(() => {
            el.style.transition = "";
          }, 200);
        }
        curY.current = 0;
      }
      lastTouchDist.current = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose, scale]);

  // mouse wheel zoom
  const onWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.06 : 0.94;
    setScale((s) => Math.min(3, Math.max(1, s * factor)));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-5 right-5 text-white text-3xl z-20"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close image"
      >
        <FiX />
      </button>

      <div
        ref={viewerRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        className="w-full h-full flex items-center justify-center overflow-hidden touch-pan-y"
        style={{ maxHeight: "100vh" }}
      >
        <img
          src={src}
          alt="Full"
          style={{
            transform: `scale(${scale})`,
            transition: "transform 120ms linear",
            maxHeight: "100%",
            maxWidth: "100%",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
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
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // separate sheets
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
    try {
      await updateDoc(doc(db, "users", uid), { blocked: !isBlocked });
      setIsBlocked(!isBlocked);
      setSheetBlockOpen(false);
    } catch (err) {
      console.error("Block toggle failed", err);
      alert("Could not update block state. Try again.");
    }
  };

  const toggleMute = async () => {
    try {
      await updateDoc(doc(db, "users", uid), { muted: !isMuted });
      setIsMuted(!isMuted);
      setSheetMuteOpen(false);
    } catch (err) {
      console.error("Mute toggle failed", err);
      alert("Could not update mute state. Try again.");
    }
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
    try {
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
    } catch (err) {
      console.error("Report failed", err);
      alert("Could not submit report. Try again.");
    }
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
          onClick={() => {
            if (friend.profilePic) setShowImage(true);
          }}
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

        {/* Name & Status */}
        <div className={styles.nameWrapper}>
          <h3 className={styles.name}>{friend.name}</h3>
          <p className={styles.status}>{formatLastSeen(friend.lastSeen)}</p>
        </div>

        {/* Buttons */}
        <div className={styles.buttonGrid}>
          <button
            onClick={() => {
              setSheetActionOpen(true);
            }}
            className={styles.button}
          >
            <FiMessageCircle /> Message
          </button>

          <button
            onClick={() => setSheetCallOpen(true)}
            className={styles.button}
          >
            <FiPhone /> Call
          </button>

          <button
            onClick={() => setSheetCallOpen(true)}
            className={styles.button}
          >
            <FiVideo /> Video
          </button>

          <button
            onClick={() => {
              setSheetMediaOpen(true);
            }}
            className={styles.button}
          >
            <FiImage /> Media
          </button>

          <button
            onClick={() => {
              downloadImage();
              // keep sheet closed if any
            }}
            className={styles.button}
          >
            <FiDownload /> Download
          </button>

          <button
            onClick={() => setSheetMuteOpen(true)}
            className={styles.button}
          >
            {isMuted ? <FiBellOff /> : <FiBell />}{" "}
            {isMuted ? "Muted" : "Notify"}
          </button>

          <button
            onClick={() => setSheetReportOpen(true)}
            className={styles.button}
          >
            <FiFlag /> Report
          </button>

          <button
            onClick={() => setSheetBlockOpen(true)}
            className={styles.blockButton}
          >
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* Fullscreen Image */}
      {showImage && friend.profilePic && (
        <FullscreenImageViewer
          src={friend.profilePic}
          onClose={() => setShowImage(false)}
        />
      )}

      {/* ACTION SHEET (Message) - separate sheet for message actions */}
      <BottomSheet open={sheetActionOpen} onClose={() => setSheetActionOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Actions</div>
          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetActionOpen(false);
              sendMessage();
            }}
          >
            <FiMessageCircle /> <span>Message</span>
          </button>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetActionOpen(false);
              viewSharedMedia();
            }}
          >
            <FiImage /> <span>View shared media</span>
          </button>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetActionOpen(false);
              downloadImage();
            }}
          >
            <FiDownload /> <span>Download profile picture</span>
          </button>
        </div>
      </BottomSheet>

      {/* CALL / VIDEO SHEET */}
      <BottomSheet open={sheetCallOpen} onClose={() => setSheetCallOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Call Options</div>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetCallOpen(false);
              alert("Voice call feature coming soon!");
            }}
          >
            <FiPhone /> Voice call
          </button>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetCallOpen(false);
              alert("Video call feature coming soon!");
            }}
          >
            <FiVideo /> Video call
          </button>
        </div>
      </BottomSheet>

      {/* MEDIA SHEET */}
      <BottomSheet open={sheetMediaOpen} onClose={() => setSheetMediaOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Shared Media</div>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              setSheetMediaOpen(false);
              viewSharedMedia();
            }}
          >
            <FiImage /> View media in chat
          </button>
        </div>
      </BottomSheet>

      {/* MUTE SHEET */}
      <BottomSheet open={sheetMuteOpen} onClose={() => setSheetMuteOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Notifications</div>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => {
              toggleMute();
            }}
          >
            {isMuted ? <FiBell /> : <FiBellOff />} {isMuted ? "Unmute" : "Mute"}
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Muting stops notifications for new messages from this user.
          </div>
        </div>
      </BottomSheet>

      {/* BLOCK CONFIRM SHEET */}
      <BottomSheet open={sheetBlockOpen} onClose={() => setSheetBlockOpen(false)}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Block {friend.name}?</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Blocked users cannot message or call you.</div>

          <button
            className="w-full text-left py-3 rounded-lg px-3 bg-red-600 text-white hover:bg-red-700 flex items-center gap-3"
            onClick={() => {
              toggleBlock();
            }}
          >
            {isBlocked ? "Unblock user" : "Block user"}
          </button>

          <button
            className="w-full text-left py-3 rounded-lg px-3 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
            onClick={() => setSheetBlockOpen(false)}
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {/* REPORT SHEET */}
      <BottomSheet open={sheetReportOpen} onClose={() => setSheetReportOpen(false)} maxHeight="50vh">
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Report {friend.name}</div>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="w-full border p-3 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Describe the issue..."
            rows={4}
          />
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 rounded bg-red-600 text-white"
              onClick={() => submitReport()}
            >
              Submit report
            </button>
            <button
              className="flex-1 py-2 rounded border"
              onClick={() => {
                setReportReason("");
                setSheetReportOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ---------------- Styles ---------------- */
const styles = {
  page: "min-h-screen p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300 flex justify-center",
  card: "w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6",

  profileWrapper: "w-24 h-24 rounded-full overflow-hidden border-2 border-gray-300 dark:border-gray-600 cursor-pointer mx-auto mb-4",
  profileImage: "w-full h-full object-cover",
  profilePlaceholder: "w-full h-full bg-gray-500 flex items-center justify-center text-white text-2xl font-bold",

  nameWrapper: "text-center mb-6",
  name: "text-xl font-semibold text-gray-900 dark:text-gray-100",
  status: "text-sm text-gray-500 dark:text-gray-400 mt-1",

  buttonGrid: "grid grid-cols-3 gap-3",
  button: "flex flex-col items-center justify-center py-3 px-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition transform hover:scale-105 shadow-sm text-xs gap-1",
  blockButton: "col-span-3 flex items-center justify-center gap-2 py-3 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition transform hover:scale-105 mt-2 shadow-sm text-sm",

  fullscreenWrapper: "fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50",
  fullscreenClose: "absolute top-5 right-5 text-white text-4xl cursor-pointer hover:text-red-500 transition",
  fullscreenImage: "max-h-full max-w-full rounded-lg shadow-2xl",

  modalWrapper: "fixed inset-0 bg-black/70 flex items-center justify-center z-50",
  modal: "bg-white dark:bg-gray-800 p-6 rounded-lg w-80 shadow-lg",
  modalTitle: "font-semibold mb-3 text-gray-900 dark:text-gray-100",
  modalTextarea: "w-full border p-2 rounded mb-4 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400",
  modalButtons: "flex justify-end gap-2",
  modalCancel: "px-3 py-1 rounded border border-gray-400 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition",
  modalSubmit: "px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition",

  loadingContainer: "min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400",
};