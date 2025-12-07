// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { FiMessageCircle, FiVideo, FiPhone, FiImage, FiSlash } from "react-icons/fi";

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return "#" + "00000".substring(0, 6 - c.length) + c;
};

const getInitials = (name) => {
  if (!name) return "NA";
  const parts = name.trim().split(" ");
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setFriend({ id: snap.id, ...snap.data() });
          setIsBlocked(snap.data().blocked || false);
        } else {
          setFriend(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  const sendMessage = () => {
    if (!currentUser || !uid) return;
    navigate(`/chat/${[currentUser.uid, uid].sort().join("_")}`);
  };

  const viewSharedMedia = () => {
    if (!friend) return;
    navigate(`/chat/${[currentUser.uid, uid].sort().join("_")}/media`);
  };

  const toggleBlock = async () => {
    if (!friend) return;
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { blocked: !isBlocked });
    setIsBlocked(!isBlocked);
  };

  const onlineStatus = () => {
    if (!friend?.lastSeen) return "Offline";
    const last = friend.lastSeen.toDate ? friend.lastSeen.toDate() : new Date(friend.lastSeen);
    const diff = Date.now() - last.getTime();
    if (diff < 60000) return "Online";
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  if (loading)
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        Loading profile…
      </div>
    );

  if (!friend)
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        No user data found for uid: {uid}
      </div>
    );

  const profileUrl = friend.profilePic || null;

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-white text-black"} min-h-screen p-4`}>
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold hover:opacity-80 transition">
          ←
        </button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* Profile Picture */}
      <div className="w-32 h-32 rounded-full mb-4 relative flex items-center justify-center border border-gray-700 overflow-hidden mx-auto shadow-md">
        {profileUrl ? (
          <img src={profileUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span
            className="text-white font-bold text-3xl flex items-center justify-center w-full h-full"
            style={{ backgroundColor: stringToColor(friend.name) }}
          >
            {getInitials(friend.name)}
          </span>
        )}
        {onlineStatus() === "Online" && (
          <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></span>
        )}
      </div>

      {/* Name / Bio */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold">{friend.name || "Unknown User"}</h2>
        <p className="text-gray-400 text-sm mt-1">{friend.bio || "No bio added."}</p>
        <p className="text-gray-500 text-xs mt-1">{onlineStatus()}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center mt-6">
        <button
          onClick={sendMessage}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow"
        >
          <FiMessageCircle /> Message
        </button>

        <button
          onClick={() => alert("Voice call feature coming soon!")}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow"
        >
          <FiPhone /> Call
        </button>

        <button
          onClick={() => alert("Video call feature coming soon!")}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition shadow"
        >
          <FiVideo /> Video
        </button>

        <button
          onClick={viewSharedMedia}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition shadow"
        >
          <FiImage /> Media
        </button>

        <button
          onClick={toggleBlock}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition shadow ${
            isBlocked ? "bg-red-600 text-white hover:bg-red-700" : "bg-yellow-500 text-black hover:bg-yellow-600"
          }`}
        >
          <FiSlash /> {isBlocked ? "Unblock" : "Block"}
        </button>
      </div>
    </div>
  );
}