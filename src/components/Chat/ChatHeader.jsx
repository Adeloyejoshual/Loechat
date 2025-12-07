import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { FiMoreVertical, FiPhone, FiVideo, FiImage } from "react-icons/fi";

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
  onViewMedia,
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Load friend info
  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
  }, [friendId]);

  // Load chat info
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

  // Close menu on outside click
  useEffect(() => {
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  // Toggle block
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const newBlocked = !chatInfo.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newBlocked });
    setChatInfo((p) => ({ ...p, blocked: newBlocked }));
    setBlockedStatus?.(newBlocked);
    setMenuOpen(false);
  };

  // Toggle mute (24h)
  const toggleMute = async () => {
    if (!chatInfo) return;
    const isMuted = chatInfo.mutedUntil && chatInfo.mutedUntil > Date.now();
    const mutedUntil = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;
    await updateDoc(doc(db, "chats", chatId), { mutedUntil });
    setChatInfo((p) => ({ ...p, mutedUntil }));
    setMenuOpen(false);
  };

  // Utilities
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "offline";
    const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - last;

    if (diff < 60000) return "Online";
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;

    return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Calls
  const startVoiceCall = () => onVoiceCall?.(chatId);
  const startVideoCall = () => onVideoCall?.(chatId);

  return (
    <>
      <div className="chat-header">
        {/* Back button */}
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* Avatar */}
        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="avatar" />
          ) : (
            <span>{getInitials(friendInfo?.name)}</span>
          )}
        </div>

        {/* Name & Last Seen */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        {/* Call Buttons */}
        <div className="chat-actions">
          <FiPhone size={21} onClick={startVoiceCall} />
          <FiVideo size={21} onClick={startVideoCall} />
          <FiImage
            size={20}
            title="View Shared Media"
            className="cursor-pointer"
            onClick={() => onViewMedia?.()}
          />
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={22} onClick={() => setMenuOpen((p) => !p)} />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch?.(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onClearChat?.(); }}>Clear Chat</div>
              <div onClick={toggleMute}>{chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}</div>
              <div onClick={toggleBlock} className="danger">{chatInfo?.blocked ? "Unblock" : "Block"}</div>
              <div onClick={() => { setMenuOpen(false); onViewMedia?.(); }}>
                <FiImage className="inline mr-1" /> View Shared Media
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned message */}
      {pinnedMessage && (
        <div className="pinned-message" onClick={() => onGoToPinned?.(pinnedMessage.id)}>
          📌 {pinnedMessage.text || (pinnedMessage.mediaType === "image" ? "Photo" : "Pinned message")}
        </div>
      )}

      <style jsx>{`
        .chat-header { display: flex; align-items: center; padding: 8px 12px; background-color: #075e54; position: sticky; top: 0; z-index: 1000; gap: 10px; }
        .chat-back { width: 38px; height: 38px; border-radius: 50%; background: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; color: white; cursor: pointer; }
        .chat-avatar { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: #ddd; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-info { flex: 1; color: white; cursor: pointer; overflow: hidden; display: flex; flex-direction: column; }
        .chat-name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-lastseen { font-size: 12px; opacity: 0.85; }
        .chat-actions { display: flex; gap: 12px; color: white; }
        .chat-menu { position: relative; color: white; }
        .menu-dropdown { position: absolute; top: 34px; right: 0; background: #fff; color: #000; border-radius: 10px; width: 190px; box-shadow: 0 4px 14px rgba(0,0,0,.3); overflow: hidden; }
        .menu-dropdown div { padding: 12px 16px; cursor: pointer; display: flex; align-items: center; }
        .menu-dropdown div:hover { background: #f0f0f0; }
        .menu-dropdown .danger { color: red; font-weight: 600; }
        .pinned-message { position: sticky; top: 56px; background: #f4f4f4; border-bottom: 1px solid #ddd; padding: 6px 12px; font-size: 13px; cursor: pointer; z-index: 999; display: flex; align-items: center; gap: 6px; }
      `}</style>
    </>
  );
}