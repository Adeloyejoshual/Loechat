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
  onSelectPinMessage,
  setBlockedStatus,
  onClearChat,
  onSearch,
  onVoiceCall,
  onVideoCall,
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, "users", friendId), (snap) => snap.exists() && setFriendInfo(snap.data()));
  }, [friendId]);

  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo(data);
      setBlockedStatus?.(data.blocked);
    });
  }, [chatId, setBlockedStatus]);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleBlock = async () => {
    const newVal = !chatInfo?.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newVal });
    setChatInfo((p) => ({ ...p, blocked: newVal }));
    setBlockedStatus?.(newVal);
    setMenuOpen(false);
  };

  const toggleMute = async () => {
    const isMuted = chatInfo?.mutedUntil > Date.now();
    const newVal = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;
    await updateDoc(doc(db, "chats", chatId), { mutedUntil: newVal });
    setChatInfo((p) => ({ ...p, mutedUntil: newVal }));
    setMenuOpen(false);
  };

  const getInitials = (name) => {
    if (!name) return "U";
    const p = name.trim().split(" ");
    return p.length > 1 ? (p[0][0] + p[1][0]).toUpperCase() : p[0][0].toUpperCase();
  };

  const formatLastSeen = (ts) => {
    if (!ts) return "offline";
    const last = ts.toDate ? ts.toDate() : new Date(ts);
    return Date.now() - last.getTime() < 60000 ? "Online" : last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendInfo?.profilePic ? <img src={friendInfo.profilePic} alt="avatar" /> : <span>{getInitials(friendInfo?.name)}</span>}
        </div>

        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        <div className="chat-actions">
          <FiPhone size={21} onClick={() => onVoiceCall?.(chatId)} />
          <FiVideo size={21} onClick={() => onVideoCall?.(chatId)} />
        </div>

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

      {/* STICKY PINNED MESSAGE */}
      {pinnedMessage && (
        <div className="pinned-message" onClick={onGoToPinned}>
          📌 {pinnedMessage.text?.slice(0, 60) || pinnedMessage.mediaType || "Pinned message"}{pinnedMessage.text?.length > 60 ? "..." : ""}
        </div>
      )}

      <style jsx>{`
        .chat-header { display: flex; align-items: center; padding: 8px 12px; background-color: #075e54; position: sticky; top: 0; z-index: 1001; gap: 10px; }
        .chat-back { width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; cursor: pointer; }
        .chat-avatar { width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: #ddd; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-info { flex: 1; display: flex; flex-direction: column; color: white; cursor: pointer; overflow: hidden; }
        .chat-name { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-lastseen { font-size: 12px; opacity: 0.85; }
        .chat-actions { display: flex; gap: 14px; color: white; }
        .chat-menu { position: relative; color: white; }
        .menu-dropdown { position: absolute; top: 34px; right: 0; background: #fff; color: #000; width: 160px; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .menu-dropdown div { padding: 12px 15px; cursor: pointer; font-size: 14px; }
        .menu-dropdown div:hover { background: #f1f1f1; }
        .danger { color: #d90000; font-weight: bold; }
        .pinned-message { background: #ececec; padding: 6px 12px; font-size: 13px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; position: sticky; top: 56px; z-index: 1000; }
      `}</style>
    </>
  );
}