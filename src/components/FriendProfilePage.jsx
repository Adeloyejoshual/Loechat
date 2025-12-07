// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import { FiMessageCircle, FiVideo, FiPhone, FiImage, FiSlash } from "react-icons/fi";

// ---------------- Utils ----------------
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

const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Offline";
  const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - last.getTime();
  if (diff < 60000) return "Online";
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

// ---------------- Component ----------------
export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [media, setMedia] = useState([]);

  // ---------------- Load friend info ----------------
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

  // ---------------- Load shared media ----------------
  useEffect(() => {
    if (!currentUser || !uid) return;
    const chatId = [currentUser.uid, uid].sort().join("_");
    const mediaRef = collection(db, "chats", chatId, "messages");
    const q = query(mediaRef, orderBy("createdAt", "desc"), limit(20));

    const fetchMedia = async () => {
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.mediaUrl)
        .reverse(); // oldest first
      setMedia(items);
    };

    fetchMedia();
  }, [currentUser, uid]);

  // ---------------- Actions ----------------
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

  const statusText = formatLastSeen(friend?.lastSeen);
  const isOnline = statusText === "Online";

  if (loading)
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-gray-100 text-black"}`}>
        Loading profile…
      </div>
    );

  if (!friend)
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-gray-100 text-black"}`}>
        No user data found for uid: {uid}
      </div>
    );

  const profileUrl = friend.profilePic || null;

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-gray-100 text-black"} min-h-screen p-4 flex flex-col items-center`}>
      {/* Back */}
      <div className="flex items-center w-full max-w-md mb-6">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold hover:opacity-80 transition mr-3">
          ←
        </button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* Profile Card */}
      <div className={`w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-6 flex flex-col items-center`}>
        {/* Profile Picture */}
        <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-gray-300 dark:border-gray-700 mb-4 shadow-lg">
          {profileUrl ? (
            <img src={profileUrl} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div
              className="flex items-center justify-center w-full h-full text-5xl font-bold text-white"
              style={{ backgroundColor: stringToColor(friend.name) }}
            >
              {getInitials(friend.name)}
            </div>
          )}
          {isOnline && <span className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-green-500 border-2 border-white"></span>}
        </div>

        {/* Name / Bio / Status */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold">{friend.name || "Unknown User"}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{friend.bio || "No bio added."}</p>
          <p className={`text-xs mt-1 ${isOnline ? "text-green-500" : "text-gray-400"}`}>{statusText}</p>
        </div>

        {/* Shared Media Preview */}
        {media.length > 0 && (
          <div className="w-full mb-6">
            <h3 className="text-sm font-semibold mb-2">Shared Media</h3>
            <div className="flex gap-2 overflow-x-auto">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden cursor-pointer shadow hover:scale-105 transition-transform"
                  onClick={viewSharedMedia}
                >
                  {item.mediaType === "image" ? (
                    <img src={item.mediaUrl} alt="media" className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.mediaUrl} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 w-full">
          <button
            onClick={sendMessage}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow w-full sm:w-auto justify-center"
          >
            <FiMessageCircle /> Message
          </button>

          <button
            onClick={() => alert("Voice call coming soon!")}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition shadow w-full sm:w-auto justify-center"
          >
            <FiPhone /> Call
          </button>

          <button
            onClick={() => alert("Video call coming soon!")}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition shadow w-full sm:w-auto justify-center"
          >
            <FiVideo /> Video
          </button>

          <button
            onClick={viewSharedMedia}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition shadow w-full sm:w-auto justify-center"
          >
            <FiImage /> Media
          </button>

          <button
            onClick={toggleBlock}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition shadow w-full sm:w-auto justify-center ${
              isBlocked ? "bg-red-600 text-white hover:bg-red-700" : "bg-yellow-500 text-black hover:bg-yellow-600"
            }`}
          >
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>
    </div>
  );
}