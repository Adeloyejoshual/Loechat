import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { FiMoreVertical, FiPhone, FiVideo } from "react-icons/fi";

export default function ChatHeader({
  friendId,
  chatId,
  pinnedMessage,
  onGoToPinned,
  onSearch,
  onClearChat,
  setBlockedStatus,
  onVoiceCall,
  onVideoCall,
}) {
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatInfo, setChatInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /** -------------------------
   * Load friend info
   ---------------------------*/
  useEffect(() => {
    if (!friendId) return;
    const ref = doc(db, "users", friendId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setFriendInfo({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [friendId]);

  /** -------------------------
   * Load chat info
   ---------------------------*/
  useEffect(() => {
    if (!chatId) return;
    const ref = doc(db, "chats", chatId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChatInfo(data);
        setBlockedStatus?.(data.blocked || false);
      }
    });
    return () => unsub();
  }, [chatId, setBlockedStatus]);

  /** -------------------------
   * Close menu when clicking outside
   ---------------------------*/
  useEffect(() => {
    const closeMenu = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  /** -------------------------
   * Mute / Unmute Chat
   * Mute for 24 hours
   ---------------------------*/
  const toggleMute = async () => {
    if (!chatInfo) return;

    const isMuted = chatInfo.mutedUntil && chatInfo.mutedUntil > Date.now();
    const newMutedUntil = isMuted ? 0 : Date.now() + 24 * 60 * 60 * 1000;

    // Update UI instantly
    setChatInfo((prev) => ({ ...prev, mutedUntil: newMutedUntil }));

    // Update Firebase
    await updateDoc(doc(db, "chats", chatId), {
      mutedUntil: newMutedUntil,
    });

    setMenuOpen(false);
  };

  /** -------------------------
   * Block / Unblock user
   ---------------------------*/
  const toggleBlock = async () => {
    if (!chatInfo) return;

    const newState = !chatInfo.blocked;

    setChatInfo((prev) => ({ ...prev, blocked: newState }));
    setBlockedStatus?.(newState);

    await updateDoc(doc(db, "chats", chatId), { blocked: newState });

    setMenuOpen(false);
  };

  /** -------------------------
   * Clear Chat (delete all messages)
   ---------------------------*/
  const handleClearChat = async () => {
    if (!chatId) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const msgs = await getDocs(messagesRef);

    const deletions = msgs.docs.map((m) =>
      deleteDoc(doc(db, "chats", chatId, "messages", m.id))
    );

    await Promise.all(deletions);

    onClearChat?.();
    setMenuOpen(false);
  };

  /** UTILITIES **/
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
    const diff = Date.now() - last.getTime();

    if (diff < 60000) return "Online";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return last.toLocaleDateString();
  };

  const startVoiceCall = () => onVoiceCall?.(chatId);
  const startVideoCall = () => onVideoCall?.(chatId);

  const goToFriendProfile = () => {
    if (friendId) navigate(`/friend/${friendId}`);
  };

  return (
    <>
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate("/chat")}>←</div>

        <div className="chat-avatar" onClick={goToFriendProfile}>
          {friendInfo?.profilePic ? (
            <img src={friendInfo.profilePic} alt="avatar" />
          ) : (
            <span>{getInitials(friendInfo?.name)}</span>
          )}
        </div>

        <div className="chat-info" onClick={goToFriendProfile}>
          <span className="chat-name">{friendInfo?.name || "Loading..."}</span>
          <span className="chat-lastseen">{formatLastSeen(friendInfo?.lastSeen)}</span>
        </div>

        <div className="chat-actions">
          <FiPhone size={21} onClick={startVoiceCall} />
          <FiVideo size={21} onClick={startVideoCall} />
        </div>

        {/* Menu */}
        <div ref={menuRef} className="chat-menu">
          <FiMoreVertical size={22} onClick={() => setMenuOpen((p) => !p)} />

          {menuOpen && (
            <div className="menu-dropdown">
              <div onClick={() => { onSearch?.(); setMenuOpen(false); }}>Search</div>

              <div onClick={handleClearChat}>Clear Chat</div>

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

      {pinnedMessage && (
        <div className="pinned-message" onClick={() => onGoToPinned?.(pinnedMessage.id)}>
          📌 {pinnedMessage.text || "Pinned message"}
        </div>
      )}
    </>
  );
}