// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { FiMoreVertical } from "react-icons/fi";
import { Phone, Video } from "react-icons/fi"; // use correct icon imports

export default function ChatHeader({ friendId, chatId, onClearChat, onSearch }) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Detect clicks outside menu to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load friend info
  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
    return () => unsub();
  }, [friendId]);

  // Load chat info
  useEffect(() => {
    if (!chatId) return;
    const unsub = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) setChatInfo(snap.data());
    });
    return () => unsub();
  }, [chatId]);

  // -------------------------
  // ACTIONS
  // -------------------------
  const toggleBlock = async () => {
    if (!chatInfo) return;
    await updateDoc(doc(db, "chats", chatId), { blocked: !chatInfo.blocked });
    setMenuOpen(false);
  };

  const toggleMute = async () => {
    if (!chatInfo) return;
    const isMuted = chatInfo.mutedUntil && chatInfo.mutedUntil > Date.now();
    await updateDoc(doc(db, "chats", chatId), {
      mutedUntil: isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000,
    });
    setMenuOpen(false);
  };

  // Helper: get initials
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  // Helper: format last seen
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const timeString = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (date.toDateString() === now.toDateString()) return `Today, ${timeString}`;
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Calls
  const startVoiceCall = () => navigate(`/call/voice/${chatId}`);
  const startVideoCall = () => navigate(`/call/video/${chatId}`);

  // Cloudinary helper
  const cloudinaryUrl = (path) => (path ? path : "");

  // Redirect to FriendProfilePage
  const handleProfileClick = () => {
    navigate(`/friend/${friendId}`);
  };

  return (
    <div
      style={{
        width: "100%",
        backgroundColor: "#0d6efd",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 999,
        boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
      }}
    >
      {/* Back */}
      <div
        onClick={() => navigate("/chat")}
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          marginRight: 10,
          color: "white",
          fontSize: 20,
          fontWeight: "600",
          userSelect: "none",
        }}
      >
        ←
      </div>

      {/* Profile */}
      <div
        onClick={handleProfileClick}
        style={{
          width: 46,
          height: 46,
          minWidth: 46,
          minHeight: 46,
          borderRadius: "50%",
          backgroundColor: "#e0e0e0",
          overflow: "hidden",
          marginRight: 12,
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "600",
          fontSize: 17,
          color: "#333",
        }}
      >
        {friendInfo?.profilePic ? (
          <img
            src={cloudinaryUrl(friendInfo.profilePic)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          getInitials(friendInfo?.name)
        )}
      </div>

      {/* Name + last seen */}
      <div
        style={{
          flex: 1,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={handleProfileClick}
      >
        <span style={{ fontSize: 16, fontWeight: "600", whiteSpace: "nowrap" }}>
          {friendInfo?.name || "Loading..."}
        </span>
        <span style={{ fontSize: 13, opacity: 0.9 }}>
          {friendInfo?.isOnline ? "Online" : formatLastSeen(friendInfo?.lastSeen)}
        </span>
      </div>

      {/* Call Buttons */}
      <div style={{ display: "flex", gap: 10, marginRight: 10 }}>
        <Phone size={22} color="white" style={{ cursor: "pointer" }} onClick={startVoiceCall} />
        <Video size={22} color="white" style={{ cursor: "pointer" }} onClick={startVideoCall} />
      </div>

      {/* Menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <FiMoreVertical
          onClick={() => setMenuOpen(!menuOpen)}
          size={24}
          color="white"
          style={{ cursor: "pointer", padding: 4 }}
        />

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 34,
              right: 0,
              background: "white",
              borderRadius: 10,
              padding: "8px 0",
              width: 165,
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}
          >
            <div style={menuItem} onClick={() => { setMenuOpen(false); onSearch(); }}>Search</div>
            <div style={menuItem} onClick={() => { setMenuOpen(false); onClearChat(); }}>Clear Chat</div>
            <div style={menuItem} onClick={toggleMute}>
              {chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}
            </div>
            <div style={{ ...menuItem, color: "red", fontWeight: 600 }} onClick={toggleBlock}>
              {chatInfo?.blocked ? "Unblock" : "Block"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const menuItem = {
  padding: "12px 16px",
  cursor: "pointer",
  fontSize: 15,
  whiteSpace: "nowrap",
};