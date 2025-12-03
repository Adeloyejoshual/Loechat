// src/components/FriendProfilePage.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { FiPhone, FiVideo } from "react-icons/fi";
import { toast } from "react-toastify";

export default function FriendProfilePage() {
  const { friendId } = useParams();
  const navigate = useNavigate();
  const [friendInfo, setFriendInfo] = useState(null);
  const [chatId, setChatId] = useState(null);
  const [isBlocked, setIsBlocked] = useState(false);

  const myUid = auth.currentUser?.uid;

  // -------------------- Load friend info --------------------
  useEffect(() => {
    if (!friendId) return;
    const unsub = onSnapshot(doc(db, "users", friendId), (snap) => {
      if (snap.exists()) setFriendInfo({ id: snap.id, ...snap.data() });
    });
    return () => unsub();
  }, [friendId]);

  // -------------------- Load chat between user and friend --------------------
  useEffect(() => {
    if (!friendId || !myUid) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "in", [[myUid, friendId], [friendId, myUid]])
    );
    getDocs(q).then((snap) => {
      if (!snap.empty) {
        const chatDoc = snap.docs[0];
        setChatId(chatDoc.id);
        setIsBlocked(chatDoc.data().blocked || false);
      }
    });
  }, [friendId, myUid]);

  // -------------------- Actions --------------------
  const toggleBlock = async () => {
    if (!chatId) {
      toast.error("No chat found with this user");
      return;
    }
    const newBlocked = !isBlocked;
    await updateDoc(doc(db, "chats", chatId), { blocked: newBlocked });
    setIsBlocked(newBlocked);
    toast.success(newBlocked ? "User blocked" : "User unblocked");
  };

  const startChat = () => {
    if (!chatId) {
      toast.error("No chat available");
      return;
    }
    navigate(`/chat/${chatId}`);
  };

  const startVoiceCall = () => {
    if (!chatId) return;
    navigate(`/call/voice/${chatId}`);
  };

  const startVideoCall = () => {
    if (!chatId) return;
    navigate(`/call/video/${chatId}`);
  };

  if (!friendInfo) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Avatar */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        {friendInfo.profilePic ? (
          <img src={friendInfo.profilePic} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#ccc",
              fontSize: 36,
              fontWeight: "bold",
            }}
          >
            {friendInfo.name?.charAt(0).toUpperCase() || "U"}
          </div>
        )}
      </div>

      {/* Name & Status */}
      <h2>{friendInfo.name || "Unknown"}</h2>
      <p style={{ color: "#666" }}>{friendInfo.lastSeen ? `Last seen: ${new Date(friendInfo.lastSeen.toDate()).toLocaleString()}` : "Offline"}</p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <button onClick={startChat} style={{ padding: "10px 20px" }}>
          Chat
        </button>
        <button onClick={startVoiceCall} style={{ padding: "10px 20px" }}>
          <FiPhone />
        </button>
        <button onClick={startVideoCall} style={{ padding: "10px 20px" }}>
          <FiVideo />
        </button>
      </div>

      <button
        onClick={toggleBlock}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: isBlocked ? "red" : "#ddd",
          color: isBlocked ? "#fff" : "#000",
        }}
      >
        {isBlocked ? "Unblock" : "Block"}
      </button>
    </div>
  );
}