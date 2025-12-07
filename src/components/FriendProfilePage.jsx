import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { ThemeContext } from "../context/ThemeContext";
import { UserContext } from "../context/UserContext";
import {
  FiMessageCircle,
  FiVideo,
  FiPhone,
  FiImage,
  FiSlash,
  FiBell,
  FiBellOff,
  FiX,
} from "react-icons/fi";

/* ---------------- Utilities ---------------- */

const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return "#" + ((hash & 0x00ffffff).toString(16)).padStart(6, "0");
};

const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
};

const formatLastSeen = (timestamp) => {
  if (!timestamp) return "Offline";
  const last = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const diff = Date.now() - last.getTime();

  if (diff < 60000) return "Online";
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  return `Last seen on ${last.toLocaleDateString()} at ${last.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

/* ---------------- Component ---------------- */

export default function FriendProfilePage() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const { currentUser } = useContext(UserContext);
  const isDark = theme === "dark";

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [media, setMedia] = useState([]);
  const [showImage, setShowImage] = useState(false);

  /* -------- Load Friend Data -------- */
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setFriend({ id: snap.id, ...snap.data() });
        setIsBlocked(snap.data().blocked || false);
        setIsMuted(snap.data().muted || false);
      } else {
        setFriend(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  /* -------- Load Shared Media -------- */
  useEffect(() => {
    if (!currentUser || !uid) return;
    const chatId = [currentUser.uid, uid].sort().join("_");

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const fetchMedia = async () => {
      const snap = await getDocs(q);
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.mediaUrl)
        .reverse();

      setMedia(items);
    };

    fetchMedia();
  }, [currentUser, uid]);

  /* -------- Actions -------- */

  const sendMessage = () => {
    const chatId = [currentUser.uid, uid].sort().join("_");
    navigate(`/chat/${chatId}`);
  };

  const viewSharedMedia = () => {
    const chatId = [currentUser.uid, uid].sort().join("_");
    navigate(`/chat/${chatId}/media`);
  };

  const toggleBlock = async () => {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { blocked: !isBlocked });
    setIsBlocked(!isBlocked);
  };

  const toggleMute = async () => {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, { muted: !isMuted });
    setIsMuted(!isMuted);
  };

  /* ---------------- Skeleton Loader ---------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-28 h-28 bg-gray-300 rounded-full animate-pulse"></div>
      </div>
    );
  }

  if (!friend) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        User not found
      </div>
    );
  }

  const isOnline = formatLastSeen(friend?.lastSeen) === "Online";

  return (
    <div className={`${isDark ? "bg-black text-white" : "bg-gray-100 text-black"} min-h-screen p-4`}>
      {/* Header */}
      <div className="flex items-center max-w-md mx-auto mb-6">
        <button onClick={() => navigate(-1)} className="text-xl font-bold mr-3">←</button>
        <h2 className="text-lg font-semibold">Profile</h2>
      </div>

      {/* Profile Card */}
      <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow p-6">
        {/* Profile Picture */}
        <div className="flex justify-center mb-4">
          <div
            onClick={() => friend.profilePic && setShowImage(true)}
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border shadow cursor-pointer"
          >
            {friend.profilePic ? (
              <img src={friend.profilePic} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white text-3xl font-bold"
                style={{ backgroundColor: stringToColor(friend.name) }}
              >
                {getInitials(friend.name)}
              </div>
            )}

            {isOnline && (
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
            )}
          </div>
        </div>

        {/* Name + Status */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold">{friend.name || "Unknown User"}</h3>
          <p className="text-sm text-gray-500">{friend.bio || "No bio available"}</p>
          <p className={`text-xs mt-1 ${isOnline ? "text-green-500" : "text-gray-400"}`}>
            {formatLastSeen(friend.lastSeen)}
          </p>
        </div>

        {/* Shared Media */}
        {media.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold mb-2">Shared Media</h4>
            <div className="flex gap-2 overflow-x-auto">
              {media.map((item) => (
                <div
                  key={item.id}
                  onClick={viewSharedMedia}
                  className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                >
                  {item.mediaType === "image" ? (
                    <img src={item.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <video src={item.mediaUrl} className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={sendMessage} className="btn-primary"><FiMessageCircle /> Message</button>
          <button className="btn-success"><FiPhone /> Call</button>
          <button className="btn-purple"><FiVideo /> Video</button>
          <button onClick={viewSharedMedia} className="btn-gray"><FiImage /> Media</button>

          <button onClick={toggleMute} className="col-span-2 btn-blue">
            {isMuted ? <FiBellOff /> : <FiBell />}
            {isMuted ? "Unmute Notifications" : "Mute Notifications"}
          </button>

          <button
            onClick={toggleBlock}
            className={`col-span-2 ${isBlocked ? "btn-danger" : "btn-warning"}`}
          >
            <FiSlash /> {isBlocked ? "Unblock" : "Block"}
          </button>
        </div>
      </div>

      {/* ✅ Fullscreen Image Viewer */}
      {showImage && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button
            onClick={() => setShowImage(false)}
            className="absolute top-5 right-5 text-white text-2xl"
          >
            <FiX />
          </button>
          <img src={friend.profilePic} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}