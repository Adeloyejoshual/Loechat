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
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ✅ FRIEND INFO
  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
  }, [friendId]);

  // ✅ CHAT INFO
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo(data);
      setBlockedStatus?.(data.blocked);
    });
  }, [chatId, setBlockedStatus]);

  // ✅ CLOSE MENU ON OUTSIDE CLICK
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // ✅ BLOCK USER
  const toggleBlock = async () => {
    if (!chatInfo || !chatId) return;
    const newBlocked = !chatInfo.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newBlocked });
    setChatInfo((prev) => ({ ...prev, blocked: newBlocked }));
    setBlockedStatus?.(newBlocked);
    setMenuOpen(false);
  };

  // ✅ MUTE USER
  const toggleMute = async () => {
    if (!chatInfo || !chatId) return;
    const isMuted = chatInfo.mutedUntil > Date.now();
    const mutedUntil = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;
    await updateDoc(doc(db, "chats", chatId), { mutedUntil });
    setChatInfo((prev) => ({ ...prev, mutedUntil }));
    setMenuOpen(false);
  };

  // ✅ UTILITIES
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
    if (diff < 60_000) return "Online";
    return last.toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ------------------ NAVIGATE TO CALL ------------------
  const handleVoiceCall = () => {
    if (!chatId || !friendId) return alert("Missing chat or friend ID");
    navigate(`/voice-call/${chatId}/${friendId}`);
  };

  const handleVideoCall = () => {
    if (!chatId || !friendId) return alert("Missing chat or friend ID");
    navigate(`/video-call/${chatId}/${friendId}`);
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        {/* ✅ AVATAR → FRIEND PROFILE */}
        <div
          className="chat-avatar"
          onClick={() => navigate(`/friend/${friendId}`)}
        >
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="avatar" />
          ) : (
            <span>{getInitials(friendInfo?.name)}</span>
          )}
        </div>

        {/* ✅ NAME → FRIEND PROFILE */}
        <div
          className="chat-info"
          onClick={() => navigate(`/friend/${friendId}`)}
        >
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">
            {formatLastSeen(friendInfo?.lastSeen)}
          </span>
        </div>

        {/* ✅ CALLS */}
        <div className="chat-actions">
          <FiPhone size={20} onClick={handleVoiceCall} />
          <FiVideo size={20} onClick={handleVideoCall} />
        </div>

        {/* ✅ MENU */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={22} onClick={() => setMenuOpen((p) => !p)} />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch?.(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onClearChat?.(); }}>Clear Chat</div>
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

      {/* ✅ PIN BAR */}
      {pinnedMessage && (
        <div
          className="pinned-message"
          onClick={() => onGoToPinned?.(pinnedMessage.id)}
        >
          📌{" "}
          {pinnedMessage.text ||
            (pinnedMessage.mediaType === "image" ? "Photo" : "Pinned message")}
        </div>
      )}
    </>
  );
}