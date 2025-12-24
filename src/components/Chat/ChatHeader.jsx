// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { FiMoreVertical, FiPhone, FiVideo } from "react-icons/fi";

export default function ChatHeader({
  friendId,
  chatId,
  pinnedMessage,
  onGoToPinned,
  onClearChat,
  onSearch,
  setBlockedStatus,
  onVoiceCall,
  onVideoCall,
  onSelectPinMessage,
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /** LOAD FRIEND INFO **/
  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
  }, [friendId]);

  /** LOAD CHAT INFO **/
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo(data);
        setBlockedStatus?.(data.blocked);
      }
    });
  }, [chatId, setBlockedStatus]);

  /** CLOSE MENU ON OUTSIDE CLICK **/
  useEffect(() => {
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  /** BLOCK / UNBLOCK **/
  const toggleBlock = async () => {
    const newValue = !chatInfo?.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newValue });
    setChatInfo((p) => ({ ...p, blocked: newValue }));
    setBlockedStatus?.(newValue);
    setMenuOpen(false);
  };

  /** MUTE / UNMUTE **/
  const toggleMute = async () => {
    const isMuted = chatInfo?.mutedUntil > Date.now();
    const newValue = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;
    await updateDoc(doc(db, "chats", chatId), { mutedUntil: newValue });
    setChatInfo((p) => ({ ...p, mutedUntil: newValue }));
    setMenuOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const p = name.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "offline";
    const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Date.now() - last.getTime();
    if (diff < 60000) return "Online";
    return last.toLocaleString([], {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="chat-header-container">
      <div className="chat-header">
        {/* BACK BUTTON */}
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* AVATAR */}
        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="avatar" />
          ) : (
            <span>{getInitials(friendInfo?.name)}</span>
          )}
        </div>

        {/* NAME + STATUS */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        {/* VOICE + VIDEO CALL */}
        <div className="chat-actions">
          <FiPhone size={21} onClick={() => onVoiceCall?.(chatId)} />
          <FiVideo size={21} onClick={() => onVideoCall?.(chatId)} />
        </div>

        {/* MENU */}
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

      {/* PINNED MESSAGE BANNER */}
      {pinnedMessage && (
        <div className="pinned-message-banner" onClick={() => onGoToPinned?.(pinnedMessage.id)}>
          📌 {pinnedMessage.text?.trim() || (pinnedMessage.mediaType === "image" ? "📷 Photo" : pinnedMessage.mediaType === "video" ? "🎥 Video" : "Pinned message")}
        </div>
      )}

      {/* STYLES */}
      <style jsx>{`
        .chat-header-container { position: sticky; top: 0; z-index: 1000; }
        .chat-header { display: flex; align-items: center; padding: 8px 12px; background-color: #075e54; gap: 10px; }
        .chat-back { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; cursor:pointer; }
        .chat-avatar { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: #ddd; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-info { flex: 1; display: flex; flex-direction: column; color: white; cursor: pointer; overflow: hidden; }
        .chat-name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-lastseen { font-size: 12px; opacity: 0.85; }
        .chat-actions { display: flex; gap: 14px; color: white; }
        .chat-menu { position: relative; color: white; }
        .menu-dropdown { position: absolute; top: 34px; right: 0; background: #fff; color: #000; width: 165px; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .menu-dropdown div { padding: 12px 15px; cursor: pointer; font-size: 14px; }
        .menu-dropdown div:hover { background: #f1f1f1; }
        .danger { color: #d90000; font-weight: bold; }
        .pinned-message-banner { background: #fff5c7; color: #111; padding: 8px 12px; font-size: 13px; cursor: pointer; border-bottom: 1px solid #e0e0b8; font-weight: 500; }
        .pinned-message-banner:hover { background: #ffef9f; }
      `}</style>
    </div>
  );
}