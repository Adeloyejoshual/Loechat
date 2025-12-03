// src/components/FriendProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { FiArrowLeft, FiMessageSquare, FiPhone, FiVideo } from "react-icons/fi";

export default function FriendProfilePage({ currentUser }) {
  const { uid } = useParams(); // <-- IMPORTANT
  const navigate = useNavigate();

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch friend data
  useEffect(() => {
    const loadUser = async () => {
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setFriend(snap.data());
        } else {
          setFriend("NOT_FOUND");
        }
      } catch (err) {
        console.error(err);
        setFriend("ERROR");
      }

      setLoading(false);
    };

    loadUser();
  }, [uid]);

  // Loading UI
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        Loading profile…
      </div>
    );
  }

  if (friend === "NOT_FOUND") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <p>User not found.</p>
        <button
          className="mt-3 px-4 py-2 bg-blue-500 rounded"
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (friend === "ERROR") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <p>Failed to load profile.</p>
        <button
          className="mt-3 px-4 py-2 bg-blue-500 rounded"
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-white/10">
        <FiArrowLeft
          size={26}
          className="mr-4"
          onClick={() => navigate(-1)}
        />
        <h1 className="text-xl font-semibold">Profile</h1>
      </div>

      {/* Profile Picture */}
      <div className="flex flex-col items-center mt-8">
        <img
          src={friend.profilePic || "/default-avatar.png"}
          alt="profile"
          className="w-32 h-32 rounded-full object-cover border border-white/20"
        />
        <h2 className="text-2xl font-bold mt-4">{friend.name}</h2>

        <p className="text-gray-400 mt-1">
          {friend.online ? "Online" : `Last seen: ${friend.lastSeen}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-around mt-8 px-6">
        <button
          onClick={() => navigate(`/chat/${uid}`)}
          className="flex flex-col items-center"
        >
          <FiMessageSquare size={28} />
          <span className="text-sm mt-1">Message</span>
        </button>

        <button onClick={() => navigate(`/voicecall/${uid}`)}>
          <FiPhone size={28} />
        </button>

        <button onClick={() => navigate(`/videocall/${uid}`)}>
          <FiVideo size={28} />
        </button>
      </div>
    </div>
  );
}