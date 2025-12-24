// src/components/Chat/ChatHeader.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
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
  const myUid = auth.currentUser?.uid;

  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /* ------------------ LOAD FRIEND ------------------ */
  useEffect(() => {
    if (!friendId) return;
    return onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo(snap.data());
    });
  }, [friendId]);

  /* ------------------ LOAD CHAT (REALTIME) ------------------ */
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setChatInfo(data);
      setBlockedStatus?.(data.blockedBy?.includes(myUid));
    });
  }, [chatId, myUid, setBlockedStatus]);

  /* ------------------ CLOSE MENU OUTSIDE ------------------ */
  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  /* ------------------ BLOCK / UNBLOCK ------------------ */
  const toggleBlock = async () => {
    if (!chatInfo) return;
    const ref = doc(db, "chats", chatId);
    const isBlocked = chatInfo.blockedBy?.includes(myUid);

    await updateDoc(ref, {
      blockedBy: isBlocked ? arrayRemove(myUid) : arrayUnion(myUid),
    });

    setMenuOpen(false);
  };

  /* ------------------ MUTE / UNMUTE ------------------ */
  const toggleMute = async () => {
    const muted = chatInfo?.mutedUntil > Date.now();
    const value = muted ? 0 : Date.now() + 24 * 60 * 60 * 1000;

    await updateDoc(doc(db, "chats", chatId), { mutedUntil: value });
    setMenuOpen(false);
  };

  /* ------------------ HELPERS ------------------ */
  const initials = (name) =>
    name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  const formatLastSeen = (ts) => {
    if (!ts) return "offline";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (Date.now() - d.getTime() < 60000) return "Online";
    return d.toLocaleString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* HEADER */}
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate(-1)}>←</div>

        <div className="chat-avatar" onClick={() => navigate(`/friend/${friendId}`)}>
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="avatar" />
          ) : (
            <span>{initials(friendInfo?.name)}</span>
          )}
        </div>

        <div className="chat-info" onClick={() => navigate(`/friend/${friendId}`)}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">
            {formatLastSeen(friendInfo?.lastSeen)}
          </span>
        </div>

        <div className="chat-actions">
          <FiPhone onClick={() => onVoiceCall?.(chatId)} />
          <FiVideo onClick={() => onVideoCall?.(chatId)} />
        </div>

        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical onClick={() => setMenuOpen((p) => !p)} />
          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { setMenuOpen(false); onSearch?.(); }}>Search</div>
              <div onClick={() => { setMenuOpen(false); onSelectPinMessage?.(); }}>
                Pin message
              </div>
              <div onClick={() => { setMenuOpen(false); onClearChat?.(); }}>
                Clear chat
              </div>
              <div onClick={toggleMute}>
                {chatInfo?.mutedUntil > Date.now() ? "Unmute" : "Mute"}
              </div>
              <div className="danger" onClick={toggleBlock}>
                {chatInfo?.blockedBy?.includes(myUid) ? "Unblock" : "Block"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PINNED MESSAGE BAR */}
      {pinnedMessage && (
        <div className="pinned-message" onClick={() => onGoToPinned?.(pinnedMessage.id)}>
          📌 {pinnedMessage.text || "Pinned message"}
        </div>
      )}
    </>
  );
}