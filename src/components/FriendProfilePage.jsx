// DebugFriendProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function DebugFriendProfilePage() {
  const { uid } = useParams();
  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          console.log("Firestore doc data:", snap.data()); // 🔍 DEBUG LOG
          setFriend({ id: snap.id, ...snap.data() });
        } else {
          console.log("No user found for uid:", uid);
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

  if (loading) return <div>Loading...</div>;

  if (!friend) return <div>No user data found for uid: {uid}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Friend Profile Debug</h2>
      <p><strong>UID:</strong> {friend.id}</p>
      <p><strong>Name:</strong> {friend.name || "(missing name)"}</p>
      <p><strong>Bio:</strong> {friend.bio || "(missing bio)"}</p>
      <p><strong>Profile Pic URL:</strong> {friend.profilePic || "(missing profilePic)"}</p>
      <img
        src={friend.profilePic || "https://via.placeholder.com/120"}
        alt="Profile"
        style={{ width: 120, height: 120, borderRadius: 60 }}
      />
    </div>
  );
}