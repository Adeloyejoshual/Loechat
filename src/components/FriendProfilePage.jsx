// src/components/FriendProfilePage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot, updateDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
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
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
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

const getCloudinaryUrl = (path, type = "image") =>
  path
    ? `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/${type === "image" ? "w_600,h_600,c_thumb" : "w_800,h_450,c_fill"}/${path}.jpg`
    : null;

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

  // Shared media state
  const [sharedMedia, setSharedMedia] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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
    if (!currentUser || !friend || currentUser.uid === uid) return;
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

  // ---------------- SHARED MEDIA ----------------
  const fetchSharedMedia = async () => {
    if (!currentUser || !uid) return;
    try {
      const mediaRef = collection(db, "messages");
      const q = query(mediaRef, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const media = [];
      snap.forEach((doc) => {
        const data = doc.data();
        if (
          (data.senderId === currentUser.uid && data.receiverId === uid) ||
          (data.senderId === uid && data.receiverId === currentUser.uid)
        ) {
          if (data.mediaPath) media.push({ mediaPath: data.mediaPath, type: data.mediaType || "image" });
        }
      });
      setSharedMedia(media);
      if (media.length) {
        setModalIndex(0);
        setModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch shared media:", err);
      alert("Failed to load shared media.");
    }
  };

  const closeModal = () => setModalOpen(false);
  const nextMedia = () => setModalIndex((prev) => (prev + 1) % sharedMedia.length);
  const prevMedia = () => setModalIndex((prev) => (prev - 1 + sharedMedia.length) % sharedMedia.length);

  const handleTouchStart = (e) => { touchStartX.current = e.changedTouches[0].screenX; };
  const handleTouchMove = (e) => { touchEndX.current = e.changedTouches[0].screenX; };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) nextMedia();
    else if (diff < -50) prevMedia();
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
        <button onClick={() => navigate(-1)} className="text-2xl font-bold hover:opacity-80 transition">←</button>
        <h2 className="text-xl font-semibold">Profile</h2>
      </div>

      {/* PROFILE PICTURE */}
      <div className="w-32 h-32 rounded-full mb-4 relative flex items-center justify-center border border-gray-700 overflow-hidden mx-auto">
        {profileUrl ? (
          <img src={profileUrl} alt="Profile" className="w-full h-full object-cover" />
        ) : (
          <span
            className="text-white font-bold text-3xl flex items-center justify-center w-full h-full"
            style={{ backgroundColor: stringToColor(friend.displayName) }}
          >
            {getInitials(friend.displayName)}
          </span>
        )}
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
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Send Message
        </button>

        {currentUser.uid !== uid && (
          <button
            onClick={toggleBlock}
            disabled={actionLoading}
            className={`py-2 rounded-lg font-semibold transition ${isBlocked ? "bg-green-600 text-white hover:bg-green-700" : "bg-red-600 text-white hover:bg-red-700"}`}
          >
            {isBlocked ? "Unblock User" : "Block User"}
          </button>
        )}

        {currentUser.uid !== uid && (
          <button
            onClick={reportUser}
            className="bg-gray-600 text-white py-2 rounded-lg font-semibold hover:bg-gray-700 transition"
          >
            Report User
          </button>
        )}

        {/* View Shared Media */}
        {currentUser.uid !== uid && (
          <button
            onClick={fetchSharedMedia}
            className="bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            View Shared Media
          </button>
        )}
      </div>

      {/* Modal */}
      {modalOpen && sharedMedia[modalIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
          onClick={closeModal}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="relative max-w-4xl max-h-full p-2 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Media Index */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded text-sm font-semibold">
              {modalIndex + 1} / {sharedMedia.length} {sharedMedia[modalIndex].type === "video" ? "🎥" : "🖼"}
            </div>

            {/* Previous */}
            <button
              onClick={prevMedia}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 text-white text-3xl font-bold p-2 hover:opacity-70"
            >
              ‹
            </button>

            {/* Media */}
            {sharedMedia[modalIndex].type === "image" ? (
              <img
                src={getCloudinaryUrl(sharedMedia[modalIndex].mediaPath, "image")}
                alt="Full"
                className="max-h-screen max-w-full rounded"
              />
            ) : (
              <video
                src={getCloudinaryUrl(sharedMedia[modalIndex].mediaPath, "video")}
                controls
                autoPlay
                className="max-h-screen max-w-full rounded"
              />
            )}

            {/* Next */}
            <button
              onClick={nextMedia}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white text-3xl font-bold p-2 hover:opacity-70"
            >
              ›
            </button>

            {/* Close */}
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 text-white text-3xl font-bold p-2 hover:opacity-70"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}