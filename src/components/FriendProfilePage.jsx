// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { FiImage } from "react-icons/fi";

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

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setFriend({ id: snap.id, ...snap.data() });
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

  if (loading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        Loading profile…
      </div>
    );
  }

  if (!friend) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        No user data found for uid: {uid}
      </div>
    );
  }

  const profileUrl = friend.profilePic || null;

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-white text-black"} min-h-screen p-4`}>
      {/* Back Button */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold hover:opacity-80 transition">←</button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* Profile Picture */}
      <div className="w-32 h-32 rounded-full mb-4 relative flex items-center justify-center border border-gray-700 overflow-hidden mx-auto">
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
      </div>

      {/* Name / Bio */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold">{friend.name || "Unknown User"}</h2>
        <p className="text-gray-400 text-sm mt-1">{friend.bio || "No bio added."}</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto mt-4">
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Send Message
        </button>

        <button
          onClick={viewSharedMedia}
          className="bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2"
        >
          <FiImage /> View Shared Media
        </button>
      </div>
    </div>
  );
}