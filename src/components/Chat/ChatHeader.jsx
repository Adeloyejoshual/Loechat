// src/components/Chat/ChatHeader.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { HiArrowLeft } from "react-icons/hi";
import { HiDotsVertical } from "react-icons/hi";

const ChatHeader = ({ chatId, otherUserId }) => {
  const navigate = useNavigate();

  const [otherUser, setOtherUser] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  // ------------------------------
  // FETCH USER DATA + CHAT SETTINGS
  // ------------------------------
  useEffect(() => {
    const unsubUser = onSnapshot(doc(db, "users", otherUserId), (snap) => {
      if (snap.exists()) setOtherUser(snap.data());
    });

    const unsubChat = onSnapshot(doc(db, "chats", chatId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsMuted(data?.muted?.includes(otherUserId) || false);
        setIsBlocked(data?.blocked?.includes(otherUserId) || false);
      }
    });

    return () => {
      unsubUser();
      unsubChat();
    };
  }, [chatId, otherUserId]);

  // ------------------------------
  // ACTIONS: Mute / Block / Clear
  // ------------------------------
  const toggleMute = async () => {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      muted: isMuted
        ? [] // Unmute
        : [otherUserId], // Mute only this user
    });
    setIsMuted(!isMuted);
    setIsMenuOpen(false);
  };

  const toggleBlock = async () => {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      blocked: isBlocked
        ? [] // Unblock
        : [otherUserId], // Block
    });
    setIsBlocked(!isBlocked);
    setIsMenuOpen(false);
  };

  const clearChat = async () => {
    if (!window.confirm("Clear all messages? This cannot be undone.")) return;

    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, { messages: [] }); // Deletes all messages in Firebase
    setIsMenuOpen(false);
  };

  if (!otherUser) return null;

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b dark:border-gray-700 flex items-center justify-between px-3 py-2 shadow-sm sticky top-0 z-20">

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <HiArrowLeft size={24} />
      </button>

      {/* USER INFO */}
      <div
        className="flex items-center gap-3 flex-1 ml-2 cursor-pointer"
        onClick={() => navigate(`/profile/${otherUserId}`)}
      >
        <img
          src={otherUser?.profilePicture}
          alt="profile"
          className="w-10 h-10 rounded-full object-cover border"
        />

        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {otherUser?.name}
          </p>
          <p className="text-xs text-green-600">
            {otherUser?.online ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* MORE MENU BUTTON */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <HiDotsVertical size={22} />
        </button>

        {/* MENU */}
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 shadow-lg rounded-xl border dark:border-gray-700 p-2">
            <button
              onClick={toggleMute}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>

            <button
              onClick={toggleBlock}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {isBlocked ? "Unblock" : "Block"}
            </button>

            <button
              onClick={() => navigate(`/media/${chatId}`)}
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              View Media
            </button>

            <button
              onClick={clearChat}
              className="w-full text-left px-3 py-2 text-red-600 rounded hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              Clear Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;