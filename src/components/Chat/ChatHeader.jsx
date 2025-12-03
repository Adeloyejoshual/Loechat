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

  // -------------------- Block & Mute --------------------
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
    const newMutedUntil = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;
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
            <img src={friendInfo.profilePic} alt={friendInfo.name || "User"} />
          ) : (
            <span>{getInitials(friendInfo?.name)}</span>
          )}
        </div>

        {/* Name + Last Seen */}
        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        {/* Call Buttons */}
        <div className="chat-actions">
          {!chatInfo?.blocked && (
            <>
              <FiPhone size={22} className="action-btn" onClick={startVoiceCall} />
              <FiVideo size={22} className="action-btn" onClick={startVideoCall} />
            </>
          )}
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={24} onClick={() => setMenuOpen(!menuOpen)} className="action-btn" />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onClearChat(); }}>Clear Chat</div>
              <div onClick={toggleMute}>{chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}</div>
              <div onClick={toggleBlock} className="danger">{chatInfo?.blocked ? "Unblock" : "Block"}</div>
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
    </>
  );
}