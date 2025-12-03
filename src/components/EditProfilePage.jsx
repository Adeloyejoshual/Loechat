// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";

// ---------------- UTILITY ----------------
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

const formatLastSeen = (ts) => {
  if (!ts) return "Last seen unavailable";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Online";

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString())
    return `Last seen: Yesterday at ${d.toLocaleTimeString([], { hour: "numeric", minute: "numeric", hour12: true })}`;

  const options = d.getFullYear() !== now.getFullYear() 
    ? { month: "long", day: "numeric", year: "numeric" } 
    : { month: "long", day: "numeric" };

  return `Last seen: ${d.toLocaleDateString(undefined, options)} at ${d.toLocaleTimeString([], { hour: "numeric", minute: "numeric", hour12: true })}`;
};

const getCloudinaryUrl = (path) => path ? `https://res.cloudinary.com/<your-cloud-name>/image/upload/w_300,h_300,c_thumb/${path}.jpg` : null;

// ---------------- COMPONENT ----------------
export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ---------------- REAL-TIME FRIEND DATA ----------------
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setFriend({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // ---------------- ACTIONS ----------------
  const toggleBlock = async () => {
    if (!currentUser || !friend) return;
    setActionLoading(true);
    try {
      const ref = doc(db, "users", uid);
      const isBlocked = friend.blockedBy?.includes(currentUser.uid);
      await updateDoc(ref, {
        blockedBy: isBlocked
          ? friend.blockedBy.filter((id) => id !== currentUser.uid)
          : [...(friend.blockedBy || []), currentUser.uid],
      });
    } catch (err) {
      console.error(err);
      alert("Failed to update block status.");
    } finally {
      setActionLoading(false);
    }
  };

  const sendMessage = () => {
    if (!currentUser || !uid) return;
    navigate(`/chat/${[currentUser.uid, uid].sort().join("_")}`);
  };

  const reportUser = () => {
    alert(`You reported ${friend?.displayName || "this user"}.`);
  };

  if (loading || !friend) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        Loading profile…
      </div>
    );
  }

  const isBlocked = friend.blockedBy?.includes(currentUser?.uid);
  const profileUrl = getCloudinaryUrl(friend.photoPath);

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-white text-black"} min-h-screen p-4`}>
      {/* BACK BUTTON HEADER */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold">←</button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* PROFILE PICTURE */}
      <div className="w-32 h-32 rounded-full mb-4 relative flex items-center justify-center border border-gray-700 overflow-hidden mx-auto">
        {profileUrl ? (
          <img src={profileUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-bold text-3xl" style={{ backgroundColor: stringToColor(friend.displayName), width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {getInitials(friend.displayName)}
          </span>
        )}

        {/* ONLINE DOT */}
        <span
          className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-white ${friend.isOnline ? "bg-green-400" : "bg-gray-400"}`}
          title={friend.isOnline ? "Online" : formatLastSeen(friend.lastSeen)}
        />
      </div>

      {/* NAME / ABOUT / LAST SEEN */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-semibold">{friend.displayName || "Unknown User"}</h2>
        <p className="text-gray-400 text-sm mt-1">{friend.about || "No bio added."}</p>
        {!friend.isOnline && <p className="text-gray-500 text-xs mt-2">{formatLastSeen(friend.lastSeen)}</p>}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex flex-col gap-3 max-w-sm mx-auto mt-4">
        <button onClick={sendMessage} className="bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition">
          Send Message
        </button>

        <button onClick={toggleBlock} disabled={actionLoading} className={`py-2 rounded-lg font-semibold transition ${isBlocked ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}>
          {isBlocked ? "Unblock User" : "Block User"}
        </button>

        <button onClick={reportUser} className="bg-gray-600 text-white py-2 rounded-lg font-semibold hover:bg-gray-700 transition">
          Report User
        </button>
      </div>
    </div>
  );
}