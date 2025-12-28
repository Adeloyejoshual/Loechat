// src/components/Chat/ChatHeader.jsx
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { FiMoreVertical, FiPhone, FiVideo } from "react-icons/fi";

export default function ChatHeader({
  friendId,
  friendName,
  friendProfilePic,
  chatId,
  pinnedMessage,
  onGoToPinned,
  onSelectPinMessage,
  setBlockedStatus,
  onClearChat,
  onSearch,
  onVoiceCall,
  onVideoCall,
}) {
  const navigate = useNavigate();
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ---------------- Close menu on outside click ----------------
  React.useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---------------- Block / Unblock ----------------
  const toggleBlock = async () => {
    const newVal = !chatInfo?.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newVal });
    setChatInfo((p) => ({ ...p, blocked: newVal }));
    setBlockedStatus?.(newVal);
    setMenuOpen(false);
  };

  // ---------------- Mute / Unmute ----------------
  const toggleMute = async () => {
    const isMuted = chatInfo?.mutedUntil > Date.now();
    const newVal = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000; // 24h
    await updateDoc(doc(db, "chats", chatId), { mutedUntil: newVal });
    setChatInfo((p) => ({ ...p, mutedUntil: newVal }));
    setMenuOpen(false);
  };

  // ---------------- Utilities ----------------
  const getInitials = (name) => {
    if (!name) return "U";
    const p = name.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase();
  };

  const getCloudinaryUrl = (url, w = 100, h = 100) => {
    if (!url?.includes("cloudinary")) return url;
    return url.replace("/upload/", `/upload/c_fill,g_face,h_${h},w_${w}/`);
  };

  return (
    <>
      {/* ---------------- Header ---------------- */}
      <div className="chat-header">
        {/* Back */}
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* Avatar */}
        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendProfilePic ? (
            <img
              src={getCloudinaryUrl(friendProfilePic, 100, 100)}
              alt="avatar"
            />
          ) : (
            <span>{getInitials(friendName)}</span>
          )}
        </div>

        {/* Info */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendName || "Loading..."}</span>
        </div>

        {/* Actions */}
        <div className="chat-actions">
          <FiPhone size={21} onClick={() => onVoiceCall?.(chatId)} />
          <FiVideo size={21} onClick={() => onVideoCall?.(chatId)} />
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={22} onClick={() => setMenuOpen((p) => !p)} />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch?.(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onSelectPinMessage?.(); }}>Pin Message</div>
              <div onClick={() => { setMenuOpen(false); onClearChat?.(); }}>Clear Chat</div>
              <div onClick={toggleMute}>{chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}</div>
              <div className="danger" onClick={toggleBlock}>{chatInfo?.blocked ? "Unblock" : "Block"}</div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Sticky Pinned Message ---------------- */}
      {pinnedMessage && (
        <div className="pinned-message" onClick={onGoToPinned}>
          📌 {pinnedMessage.text?.slice(0, 60) || pinnedMessage.mediaType || "Pinned message"}{pinnedMessage.text?.length > 60 ? "..." : ""}
        </div>
      )}

      <style jsx>{`
        .chat-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: #075e54;
          position: sticky;
          top: 0;
          z-index: 1001;
          gap: 10px;
        }
        .chat-back {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 20px;
          cursor: pointer;
        }
        .chat-avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          overflow: hidden;
          background: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #fff;
        }
        .chat-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .chat-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          color: white;
          cursor: pointer;
          overflow: hidden;
        }
        .chat-name {
          font-size: 15px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-actions {
          display: flex;
          gap: 14px;
          color: white;
        }
        .chat-menu {
          position: relative;
          color: white;
        }
        .menu-dropdown {
          position: absolute;
          top: 34px;
          right: 0;
          background: #fff;
          color: #000;
          width: 160px;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .menu-dropdown div {
          padding: 12px 15px;
          cursor: pointer;
          font-size: 14px;
        }
        .menu-dropdown div:hover {
          background: #f1f1f1;
        }
        .danger {
          color: #d90000;
          font-weight: bold;
        }
        .pinned-message {
          background: #ececec;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          position: sticky;
          top: 56px;
          z-index: 1000;
        }
      `}</style>
    </>
  );
}