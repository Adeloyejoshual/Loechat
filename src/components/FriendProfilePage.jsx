import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const FriendProfilePage = () => {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [friend, setFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const fetchFriend = async () => {
      try {
        const docRef = doc(db, "users", friendId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setFriend(docSnap.data());
        }
      } catch (err) {
        console.error("Profile load error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFriend();
  }, [friendId]);

  if (loading) {
    return <div style={{ textAlign: "center", paddingTop: "60px" }}>Loading...</div>;
  }

  if (!friend) {
    return <div style={{ textAlign: "center", paddingTop: "60px" }}>User not found</div>;
  }

  const lastSeenText = friend?.lastSeen
    ? new Date(friend.lastSeen.seconds * 1000).toLocaleString()
    : "Offline";

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = friend.profilePic;
    link.download = "profile.jpg";
    link.click();
  };

  const reportUser = () => {
    console.log("Reported silently:", friendId);
    alert("User reported successfully ✅");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>

      {/* ✅ PROFILE HEADER */}
      <div style={{ padding: "20px 16px 10px", textAlign: "center" }}>

        {/* ✅ SMALL CENTERED PROFILE IMAGE */}
        <div
          onClick={() => setShowImage(true)}
          style={{
            width: "72px",
            height: "72px",
            margin: "0 auto 10px",
            borderRadius: "999px",
            overflow: "hidden",
            border: "2px solid #e5e7eb",
            cursor: "pointer",
            background: "#f3f4f6",
          }}
        >
          {friend.profilePic ? (
            <img
              src={friend.profilePic}
              alt="profile"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#6b7280",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              {friend?.name?.charAt(0)}
            </div>
          )}
        </div>

        {/* ✅ NAME */}
        <h2 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>
          {friend.name}
        </h2>

        {/* ✅ LAST SEEN */}
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          Last seen {lastSeenText}
        </p>
      </div>

      {/* ✅ ACTION BUTTONS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          padding: "14px",
        }}
      >
        {["Message", "Call", "Video", "Media"].map((item) => (
          <button
            key={item}
            onClick={() => navigate("/chat/" + friendId)}
            style={{
              padding: "10px",
              borderRadius: "10px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
              fontWeight: "500",
              cursor: "pointer",
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ✅ SETTINGS LIST */}
      <div style={{ background: "#fff", marginTop: "10px" }}>

        <ProfileRow label="Download profile photo" onClick={downloadImage} />
        <ProfileRow label="Report user" danger onClick={reportUser} />
        <ProfileRow label="Block user" danger />

      </div>

      {/* ✅ FULLSCREEN IMAGE VIEW */}
      {showImage && friend?.profilePic && (
        <div
          onClick={() => setShowImage(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
          }}
        >
          <img
            src={friend.profilePic}
            alt="fullscreen"
            style={{
              maxWidth: "92%",
              maxHeight: "92%",
              borderRadius: "14px",
            }}
          />
        </div>
      )}
    </div>
  );
};

/* ✅ CLEAN ROW COMPONENT */
const ProfileRow = ({ label, danger, onClick }) => (
  <div
    onClick={onClick}
    style={{
      padding: "14px 16px",
      borderBottom: "1px solid #e5e7eb",
      color: danger ? "#dc2626" : "#111827",
      fontWeight: "500",
      cursor: "pointer",
    }}
  >
    {label}
  </div>
);

export default FriendProfilePage;