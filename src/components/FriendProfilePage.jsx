// src/components/FriendProfilePage.jsx

import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import {
  FiMessageCircle,
  FiPhone,
  FiVideo,
  FiDownload,
  FiSlash,
  FiBell,
  FiBellOff,
  FiFlag,
  FiX,
  FiArrowLeft,
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
  return `Last seen on ${last.toLocaleDateString()}`;
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

  /* ---------------- FIRESTORE ---------------- */
  useEffect(() => {
    if (!uid || !currentUser?.uid) return;

    const friendRef = doc(db, "users", uid);
    const myRef = doc(db, "users", currentUser.uid);

    const unsubFriend = onSnapshot(friendRef, (snap) => {
      if (snap.exists()) setFriend({ id: snap.id, ...snap.data() });
    });

    const unsubMe = onSnapshot(myRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsBlocked(data?.blockedUsers?.includes(uid));
        setIsMuted(data?.mutedUsers?.includes(uid));
      }
      setLoading(false);
    });

    return () => {
      unsubFriend();
      unsubMe();
    };
  }, [uid, currentUser]);

  /* ---------------- ACTIONS ---------------- */

  const sendMessage = () => {
    const chatId = [currentUser.uid, uid].sort().join("_");
    navigate(`/chat/${chatId}`);
  };

  const toggleBlock = async () => {
    const myRef = doc(db, "users", currentUser.uid);
    await updateDoc(myRef, {
      blockedUsers: isBlocked ? arrayRemove(uid) : arrayUnion(uid),
    });
    setIsBlocked(!isBlocked);
  };

  const toggleMute = async () => {
    const myRef = doc(db, "users", currentUser.uid);
    await updateDoc(myRef, {
      mutedUsers: isMuted ? arrayRemove(uid) : arrayUnion(uid),
    });
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

    await fetch(`https://www.loechat.com/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "loechatapp@gmail.com",
        subject: "New User Report",
        body: `Reporter: ${currentUser.uid}\nReported: ${uid}\nReason:\n${reportReason}`,
      }),
    });

    setShowReport(false);
    setReportReason("");
    alert("✅ Report submitted secretly");
  };

  if (loading) return <div className="friend-loading">Loading...</div>;
  if (!friend) return <div className="friend-loading">User not found</div>;

  return (
    <div className={`friend-wrapper ${isDark ? "dark" : ""}`}>
      {/* HEADER */}
      <div className="friend-header">
        <FiArrowLeft onClick={() => navigate(-1)} />
        <span>Profile</span>
      </div>

      {/* PROFILE IMAGE */}
      <div className="friend-avatar-wrapper">
        <div className="friend-avatar" onClick={() => setShowImage(true)}>
          {friend.profilePic ? (
            <img src={friend.profilePic} alt="profile" />
          ) : (
            <span>{getInitials(friend.name)}</span>
          )}
        </div>
      </div>

      {/* INFO */}
      <div className="friend-info">
        <h3>{friend.name}</h3>
        <p className="bio">{friend.bio || "No bio available"}</p>
        <p>{formatLastSeen(friend.lastSeen)}</p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="friend-actions">
        <button onClick={sendMessage}><FiMessageCircle /> Message</button>
        <button><FiPhone /> Call</button>
        <button><FiVideo /> Video</button>
        <button onClick={downloadImage}><FiDownload /> Download</button>
        <button onClick={toggleMute}>
          {isMuted ? <FiBellOff /> : <FiBell />} Notify
        </button>
        <button onClick={() => setShowReport(true)}><FiFlag /> Report</button>
        <button className="danger" onClick={toggleBlock}>
          <FiSlash /> {isBlocked ? "Unblock" : "Block"}
        </button>
      </div>

      {/* FULL IMAGE */}
      {showImage && (
        <div className="fullscreen-img">
          <FiX onClick={() => setShowImage(false)} />
          <img src={friend.profilePic} alt="full" />
        </div>
      )}

      {/* REPORT MODAL */}
      {showReport && (
        <div className="report-modal">
          <div className="report-box">
            <h3>Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
            <div>
              <button onClick={() => setShowReport(false)}>Cancel</button>
              <button className="danger" onClick={submitReport}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}