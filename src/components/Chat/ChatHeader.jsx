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
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo(data);
        if (setBlockedStatus) setBlockedStatus(data.blocked);
      }
    });
    return () => unsub();
  }, [chatId, setBlockedStatus]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleBlock = async () => {
    if (!chatInfo) return;
    const newBlocked = !chatInfo.blocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newBlocked });
    setChatInfo((prev) => ({ ...prev, blocked: newBlocked }));
    if (setBlockedStatus) setBlockedStatus(newBlocked);
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

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const formattedHour = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    const timeString = `${formattedHour}:${formattedMinutes} ${ampm}`;

    const today = new Date();
    if (date.toDateString() === today.toDateString()) return `Today at ${timeString}`;

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${timeString}`;

    if (date.getFullYear() === now.getFullYear())
      return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeString}`;

    return `${date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const startVoiceCall = () => navigate(`/call/voice/${chatId}`);
  const startVideoCall = () => navigate(`/call/video/${chatId}`);
  const pinned = chatInfo?.pinnedMessage || null;

  return (
    <>
      <div
        style={{
          width: "100%",
          backgroundColor: "#075e54",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 999,
          gap: 10,
        }}
      >
        {/* Back button */}
        <div
          onClick={() => navigate("/chat")}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: "pointer",
            color: "white",
            fontSize: 22,
            fontWeight: "600",
          }}
        >
          ←
        </div>

        {/* Avatar */}
        <div
          onClick={() => navigate(`/friend/${friendId}`)}
          style={{
            width: 50,
            height: 50,
            minWidth: 50,
            minHeight: 50,
            borderRadius: "50%",
            backgroundColor: "#e0e0e0",
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontWeight: "600",
            fontSize: 18,
            color: "#333",
          }}
        >
          {friendInfo?.profilePic ? (
            <img
              src={friendInfo.profilePic}
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
          onClick={() => navigate(`/friend/${friendId}`)}
        >
          <span style={{ fontSize: 16, fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {friendInfo?.name || "Loading..."}
          </span>
          <span style={{ fontSize: 13, opacity: 0.9 }}>
            {friendInfo?.isOnline ? "Online" : formatLastSeen(friendInfo?.lastSeen)}
          </span>
        </div>

        {/* Call buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <FiPhone size={22} color="white" onClick={startVoiceCall} style={{ cursor: "pointer" }} />
          <FiVideo size={22} color="white" onClick={startVideoCall} style={{ cursor: "pointer" }} />
        </div>

        {/* Menu */}
        <div ref={menuRef} style={{ position: "relative", marginLeft: 8 }}>
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
                top: 36,
                right: 0,
                background: "#fff",
                color: "#000",
                borderRadius: 10,
                padding: "8px 0",
                width: 170,
                boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                zIndex: 999,
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

      {/* Pinned message */}
      {pinned && (
        <div
          onClick={() => onGoToPinned(pinned.messageId)}
          style={{
            position: "sticky",
            top: 56,
            width: "100%",
            background: "#f7f7f7",
            padding: "6px 12px",
            borderBottom: "1px solid #ddd",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            color: "#444",
            zIndex: 998,
          }}
        >
          📌
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90%" }}>
            {pinned.text || "Pinned message"}
          </span>
        </div>
      )}
    </>
  );
}

const menuItem = {
  padding: "12px 16px",
  cursor: "pointer",
  fontSize: 15,
  whiteSpace: "nowrap",
};