// src/components/SharedMediaPage.jsx
import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { ThemeContext } from "../context/ThemeContext";

// Cloudinary URL helper
const getCloudinaryUrl = (path, type = "image") => {
  if (!path) return null;
  if (type === "image") {
    return `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload/w_400,h_400,c_thumb/${path}.jpg`;
  } else if (type === "video") {
    return `https://res.cloudinary.com/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload/w_400,h_400,c_thumb/${path}.mp4`;
  }
  return path;
};

export default function SharedMediaPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) return;

    const loadMedia = async () => {
      setLoading(true);
      try {
        const messagesRef = collection(db, "messages");
        const q = query(
          messagesRef,
          where("chatId", "==", chatId),
          where("type", "in", ["image", "video"]),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setMedia(items);
      } catch (err) {
        console.error("Failed to load shared media:", err);
        alert("Failed to load shared media. Check console.");
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [chatId]);

  if (loading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        Loading shared media…
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className={`flex h-screen flex-col items-center justify-center ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
        <p>No media shared in this chat yet.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 ${isDark ? "bg-black text-white" : "bg-white text-black"}`}>
      <div className="flex items-center mb-4">
        <button onClick={() => navigate(-1)} className="text-2xl font-bold hover:opacity-80 transition">←</button>
        <h2 className="text-xl font-semibold ml-3">Shared Media</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {media.map((m) => (
          <div key={m.id} className="relative rounded overflow-hidden shadow hover:scale-105 transition cursor-pointer">
            {m.type === "image" ? (
              <img
                src={getCloudinaryUrl(m.mediaPath, "image")}
                alt="Shared"
                className="w-full h-40 object-cover"
                onClick={() => window.open(getCloudinaryUrl(m.mediaPath, "image"), "_blank")}
              />
            ) : (
              <video
                src={getCloudinaryUrl(m.mediaPath, "video")}
                className="w-full h-40 object-cover"
                controls
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}