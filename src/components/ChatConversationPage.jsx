// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { FiMoreVertical, FiPhone, FiVideo } from "react-icons/fi";

export default function ChatHeader({
  friendId,
  chatId,
  onClearChat,
  onSearch,
  onGoToPinned,
  setBlockedStatus,
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // -------------------- Load Friend Info --------------------
  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  // -------------------- Load Chat Info --------------------
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo(data);
        setBlockedStatus && setBlockedStatus(data.blocked);
      }
    });
    return () => unsub();
  }, [chatId, setBlockedStatus]);

  // -------------------- Close Menu on Outside Click --------------------
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -------------------- Toggle Block & Mute --------------------
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const newBlocked = !chatInfo.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newBlocked });
    setChatInfo((prev) => ({ ...prev, blocked: newBlocked }));
    setBlockedStatus && setBlockedStatus(newBlocked);
    setMenuOpen(false);
  };

  const toggleMute = async () => {
    if (!chatInfo) return;
    const isMuted = chatInfo.mutedUntil && chatInfo.mutedUntil > Date.now();
    const newMutedUntil = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await updateDoc(doc(db, "chats", chatId), { mutedUntil: newMutedUntil });
    setChatInfo((prev) => ({ ...prev, mutedUntil: newMutedUntil }));
    setMenuOpen(false);
  };

  // -------------------- Utilities --------------------
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const lastSeenDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    // Online if last seen within 1 minute
    if (now - lastSeenDate <= 60 * 1000) return "Online";

    const hours = lastSeenDate.getHours();
    const minutes = lastSeenDate.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const formattedHour = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const timeString = `${formattedHour}:${formattedMinutes} ${ampm}`;

    const today = new Date();
    if (lastSeenDate.toDateString() === today.toDateString()) return `Today at ${timeString}`;

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (lastSeenDate.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeString}`;

    if (lastSeenDate.getFullYear() === now.getFullYear()) {
      return `${lastSeenDate.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeString}`;
    }

    return `${lastSeenDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${timeString}`;
  };

  const startVoiceCall = () => navigate(`/call/voice/${chatId}`);
  const startVideoCall = () => navigate(`/call/video/${chatId}`);
  const pinned = chatInfo?.pinnedMessage || null;

  // -------------------- Render --------------------
  return (
    <>
      <div className="chat-header">
        {/* Back Button */}
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* Avatar */}
        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="" />
          ) : (
            getInitials(friendInfo?.name)
          )}
        </div>

        {/* Name + Last Seen */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        {/* Call Buttons */}
        <div className="chat-actions">
          <FiPhone size={22} className="action-btn" onClick={startVoiceCall} />
          <FiVideo size={22} className="action-btn" onClick={startVideoCall} />
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={24} onClick={() => setMenuOpen(!menuOpen)} className="action-btn" />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onClearChat(); }}>Clear Chat</div>
              <div onClick={toggleMute}>
                {chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}
              </div>
              <div onClick={toggleBlock} className="danger">
                {chatInfo?.blocked ? "Unblock" : "Block"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned Message */}
      {pinned && (
        <div className="pinned-message" onClick={() => onGoToPinned(pinned.messageId)}>
          📌 <span>{pinned.text || "Pinned message"}</span>
        </div>
      )}

      {/* -------------------- Styles -------------------- */}
      <style jsx>{`
        .chat-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: #075e54;
          position: sticky;
          top: 0;
          z-index: 999;
          gap: 10px;
        }
        .chat-back {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          color: white;
          font-size: 22px;
          font-weight: 600;
          transition: background 0.2s;
        }
        .chat-back:hover {
          background: rgba(255,255,255,0.25);
        }
        .chat-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          overflow: hidden;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          font-weight: 600;
          font-size: 18px;
          color: #333;
          background-color: #e0e0e0;
        }
        .chat-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .chat-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          cursor: pointer;
          color: #fff;
        }
        .chat-name {
          font-size: 16px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-lastseen {
          font-size: 13px;
          opacity: 0.9;
        }
        .chat-actions {
          display: flex;
          gap: 10px;
        }
        .action-btn {
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .action-btn:hover {
          opacity: 0.7;
        }
        .chat-menu {
          position: relative;
          margin-left: 8px;
        }
        .menu-dropdown {
          position: absolute;
          top: 36px;
          right: 0;
          background: #fff;
          color: #000;
          border-radius: 10px;
          padding: 8px 0;
          width: 170px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.3);
          z-index: 999;
        }
        .menu-dropdown div {
          padding: 12px 16px;
          cursor: pointer;
          font-size: 15px;
          white-space: nowrap;
          transition: background 0.2s;
        }
        .menu-dropdown div:hover {
          background: #f0f0f0;
        }
        .menu-dropdown .danger {
          color: red;
          font-weight: 600;
        }
        .pinned-message {
          position: sticky;
          top: 56px;
          width: 100%;
          background: #f7f7f7;
          padding: 6px 12px;
          border-bottom: 1px solid #ddd;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          color: #444;
          z-index: 998;
        }
      `}</style>
    </>
  );
}