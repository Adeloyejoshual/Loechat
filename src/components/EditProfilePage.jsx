import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function EditProfilePage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef(null);

  /* ================= SWIPE STATE ================= */
  const [startX, setStartX] = useState(null);
  const [slideX, setSlideX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  /* ================= AUTH + LOAD ================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/settings");
      setUser(u);

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || "");
        setBio(d.bio || "");
        setProfilePic(d.profilePic || null);
      }
    });

    return () => unsub();
  }, []);

  /* ================= CLOUDINARY ================= */
  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );

    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return data.secure_url;
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setProfilePic(URL.createObjectURL(file));

    try {
      const url = await uploadToCloudinary(file);
      await updateDoc(doc(db, "users", user.uid), {
        profilePic: url,
        updatedAt: serverTimestamp(),
      });
      setProfilePic(url);
      showPopup("✅ Profile image updated");
    } catch {
      showPopup("❌ Image upload failed");
    }
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await updateDoc(doc(db, "users", user.uid), {
        name,
        bio,
        updatedAt: serverTimestamp(),
      });

      showPopup("✅ Profile updated");
      navigate("/settings");
    } catch {
      showPopup("❌ Update failed");
    } finally {
      setSaving(false);
    }
  };

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/chat");
  };

  /* ================= SWIPE HANDLERS ================= */
  const onTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (startX === null) return;

    const delta = e.touches[0].clientX - startX;
    if (delta < 0) setSlideX(delta); // RIGHT → LEFT only
  };

  const onTouchEnd = () => {
    setIsDragging(false);

    if (Math.abs(slideX) > window.innerWidth * 0.35) {
      navigate("/settings");
    } else {
      setSlideX(0);
    }
    setStartX(null);
  };

  if (!user) return <p>Loading...</p>;

  /* ================= PARALLEL EFFECT ================= */
  const progress = Math.min(Math.abs(slideX) / window.innerWidth, 1);
  const foregroundX = slideX;
  const backgroundX = slideX * 0.3;
  const blur = progress * 6;
  const opacity = 1 - progress * 0.15;

  return (
    <>
      {/* BACKGROUND LAYER */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: isDark ? "#1c1c1c" : "#f8f8f8",
          transform: `translateX(${backgroundX}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease-out",
        }}
      />

      {/* FOREGROUND */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          padding: 20,
          minHeight: "100vh",
          background: isDark ? "#1c1c1c" : "#f8f8f8",
          color: isDark ? "#fff" : "#000",

          transform: `translateX(${foregroundX}px)`,
          filter: `blur(${blur}px)`,
          opacity,

          transition: isDragging
            ? "none"
            : "transform 0.3s ease-out, filter 0.3s ease-out, opacity 0.3s ease-out",

          touchAction: "pan-y",
        }}
      >
        {/* BACK */}
        <div
          onClick={() => navigate("/settings")}
          style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}
        >
          ← Back
        </div>

        <h2 style={{ textAlign: "center", marginBottom: 20 }}>✏️ Edit Profile</h2>

        {/* PROFILE IMAGE */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            onClick={() => fileInputRef.current.click()}
            style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              margin: "0 auto",
              background: profilePic
                ? `url(${profilePic}) center/cover`
                : "#888",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: "bold",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {!profilePic && (name?.[0] || "U")}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        {/* FORM */}
        <div style={cardStyle}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

          <label>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ ...inputStyle, height: 80 }}
          />

          <button onClick={handleSave} style={saveBtn} disabled={saving}>
            {saving ? "Saving..." : "✅ Save Changes"}
          </button>
        </div>

        {/* LOG OUT */}
        <div style={{ marginTop: 20 }}>
          <button onClick={handleLogout} style={logoutBtn}>
            🚪 Log Out
          </button>
        </div>
      </div>
    </>
  );
}

/* ================= STYLES ================= */
const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  marginBottom: 12,
};

const cardStyle = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
};

const saveBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#00e676",
  fontWeight: "bold",
};

const logoutBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#ff5252",
  color: "#fff",
  fontWeight: "bold",
};