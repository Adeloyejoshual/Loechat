// src/components/FriendProfilePage.jsx

import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
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
  FiImage,
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

  /* ---------------- FIRESTORE ---------------- */
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
    if (!friend?.profilePic) return;
    const link = document.createElement("a");
    link.href = friend.profilePic;
    link.download = `${friend.name || "profile"}.jpg`;
    link.click();
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return alert("Enter report reason");

    await fetch(`https://www.loechat.com/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reporterId: currentUser.uid,
        reportedId: uid,
        reason: reportReason,
      }),
    });

    // Send secretly to loechatapp@gmail.com
    await fetch(`https://www.loechat.com/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "loechatapp@gmail.com",
        subject: "New user report",
        body: `Reporter: ${currentUser.uid}\nReported: ${uid}\nReason: ${reportReason}`
      })
    });

    setShowReport(false);
    setReportReason("");
    alert("✅ Report submitted secretly");
  };

  if (loading)
    return <div className="friend-loading">Loading...</div>;

  if (!friend)
    return <div className="friend-loading">User not found</div>;

  return (
    <div className={`friend-wrapper ${isDark ? "dark" : ""}`}>

      {/* HEADER WITH BACK */}
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

      {/* SHARED MEDIA */}
      <div className="shared-media">
        <h4>Shared Media</h4>
        <div className="media-list">
          {friend.sharedMedia && friend.sharedMedia.length > 0 ? (
            friend.sharedMedia.map((media, index) => (
              <img key={index} src={media} alt="shared" />
            ))
          ) : (
            <p>No media shared yet.</p>
          )}
        </div>
      </div>

      {/* FULLSCREEN IMAGE */}
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
              placeholder="Enter reason..."
            />
            <div>
              <button onClick={() => setShowReport(false)}>Cancel</button>
              <button className="danger" onClick={submitReport}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* STYLES */}
      <style>{`
        .friend-wrapper {
          min-height: 100vh;
          background: linear-gradient(180deg, #1f7a4c, #38a169);
          padding: 20px 15px;
        }

        .friend-header {
          display: flex;
          align-items: center;
          gap: 12px;
          color: white;
          font-size: 17px;
          margin-bottom: 15px;
          cursor: pointer;
        }

        .friend-avatar-wrapper {
          display: flex;
          justify-content: center;
          margin-top: 10px;
        }

        .friend-avatar {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid white;
          background: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          color: white;
          cursor: pointer;
        }

        .friend-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .friend-info {
          text-align: center;
          margin-top: 12px;
          color: white;
        }

        .friend-info h3 {
          font-size: 20px;
          font-weight: bold;
        }

        .friend-info .bio {
          font-size: 14px;
          color: #e0e0e0;
          margin: 4px 0;
        }

        .friend-actions {
          margin-top: 25px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .friend-actions button {
          padding: 12px;
          border-radius: 10px;
          background: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 14px;
        }

        .friend-actions .danger {
          grid-column: span 2;
          background: #e63946;
          color: white;
        }

        .shared-media {
          margin-top: 25px;
          color: white;
        }

        .shared-media h4 {
          margin-bottom: 10px;
        }

        .media-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .media-list img {
          width: 70px;
          height: 70px;
          border-radius: 8px;
          object-fit: cover;
        }

        .fullscreen-img {
          position: fixed;
          inset: 0;
          background: black;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .fullscreen-img img {
          max-width: 100%;
          max-height: 100%;
        }

        .fullscreen-img svg {
          position: absolute;
          top: 20px;
          right: 20px;
          font-size: 26px;
          color: white;
          cursor: pointer;
        }

        .report-modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .report-box {
          background: white;
          padding: 20px;
          width: 280px;
          border-radius: 12px;
        }

        .report-box textarea {
          width: 100%;
          height: 80px;
          margin-bottom: 10px;
        }

        .friend-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
}