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
  const [friend, setFriend] = useState(null);
  const [chat, setChat] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // -------------------- Fetch Friend --------------------
  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriend(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  // -------------------- Fetch Chat --------------------
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChat(data);
      setBlockedStatus?.(data.blocked);
    });
    return () => unsub();
  }, [chatId, setBlockedStatus]);

  // -------------------- Close Menu on Click Outside --------------------
  useEffect(() => {
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  // -------------------- Actions --------------------
  const toggleBlock = async () => {
    const newState = !chat?.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newState });
    setBlockedStatus?.(newState);
    setMenuOpen(false);
  };

  const toggleMute = async () => {
    const isMuted = chat?.mutedUntil > Date.now();
    const until = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await updateDoc(doc(db, "chats", chatId), { mutedUntil: until });
    setMenuOpen(false);
  };

  // -------------------- Utilities --------------------
  const initials = (name) => {
    if (!name) return "U";
    const parts = name.split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const lastSeenText = (timestamp) => {
    if (!timestamp) return "";
    const lastSeen = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();

    if (now - lastSeen <= 60 * 1000) return "Online";

    const time = lastSeen.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastSeen.toDateString() === today.toDateString()) return `Today at ${time}`;
    if (lastSeen.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;

    return lastSeen.toLocaleDateString([], { month: "short", day: "numeric" }) + ` at ${time}`;
  };

  // -------------------- WebRTC Call Navigation --------------------
  const startVoiceCall = () => {
    if (!chatId || !friendId) return;
    navigate(`/call/voice/${chatId}/${friendId}`);
  };

  const startVideoCall = () => {
    if (!chatId || !friendId) return;
    navigate(`/call/video/${chatId}/${friendId}`);
  };

  const pinned = chat?.pinnedMessage;

  // -------------------- UI --------------------
  return (
    <>
      <div className="chat-header">
        {/* Back */}
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* Avatar */}
        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friend?.profilePic ? <img src={friend.profilePic} alt="avatar" /> : <span>{initials(friend?.name)}</span>}
        </div>

        {/* Name & Last Seen */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friend?.name || "Loading..."}</span>
          <span className="chat-lastseen">{lastSeenText(friend?.lastSeen)}</span>
        </div>

        {/* Action Buttons */}
        <div className="chat-actions">
          <FiPhone size={22} className="action-btn" onClick={startVoiceCall} />
          <FiVideo size={22} className="action-btn" onClick={startVideoCall} />
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={24} className="action-btn" onClick={() => setMenuOpen(v => !v)} />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onClearChat(); }}>Clear Chat</div>
              <div onClick={toggleMute}>{chat?.mutedUntil > Date.now() ? "Unmute" : "Mute"}</div>
              <div onClick={toggleBlock} className="danger">{chat?.blocked ? "Unblock" : "Block"}</div>
            </div>
          )}
        </div>
      </div>

      {/* Pinned Message */}
      {pinned && (
        <div className="pinned-message" onClick={() => onGoToPinned(pinned.messageId)}>
          📌 <span>{pinned.text}</span>
        </div>
      )}

      {/* -------------------- Styles -------------------- */}
      <style jsx>{`
        .chat-header { display: flex; align-items: center; background: #075e54; padding: 8px 12px; gap: 10px; position: sticky; top: 0; z-index: 1000; }
        .chat-back { width: 40px; height: 40px; background: rgba(255,255,255,0.15); border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; color: #fff; font-size: 20px; transition: background 0.2s; }
        .chat-back:hover { background: rgba(255,255,255,0.25); }
        .chat-avatar { width: 47px; height: 47px; border-radius: 50%; color: #333; background: #d8d8d8; overflow: hidden; display: flex; justify-content: center; align-items: center; font-weight: bold; cursor: pointer; }
        .chat-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .chat-info { flex: 1; color: white; overflow: hidden; }
        .chat-name { font-size: 16px; font-weight: 600; white-space: nowrap; }
        .chat-lastseen { font-size: 13px; opacity: 0.9; }
        .chat-actions { display: flex; gap: 12px; }
        .action-btn { color: white; cursor: pointer; transition: opacity 0.2s; }
        .action-btn:hover { opacity: 0.7; }
        .chat-menu { position: relative; }
        .menu-dropdown { position: absolute; right: 0; top: 34px; width: 170px; background: #fff; border-radius: 10px; box-shadow: 0 6px 18px rgba(0,0,0,0.25); animation: fadeIn 0.15s ease; }
        .menu-dropdown div { padding: 12px 15px; cursor: pointer; font-size: 15px; border-bottom: 1px solid #eee; }
        .menu-dropdown div:last-child { border-bottom: none; }
        .menu-dropdown div:hover { background: #f2f2f2; }
        .danger { color: red; font-weight: 600; }
        .pinned-message { background: #fff8d1; padding: 6px 12px; border-bottom: 1px solid #e5e5e5; font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; position: sticky; top: 60px; z-index: 900; }
      `}</style>
    </>
  );
}