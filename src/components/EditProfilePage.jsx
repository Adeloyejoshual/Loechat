// src/components/EditProfilePage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import { useAd } from "./AdGateway"; // Hook to load ads

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function EditProfilePage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const { loadBannerAd } = useAd();

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [adLoaded, setAdLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const isDark = theme === "dark";

  // Load user profile
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");
      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      }
    });
    return () => unsubAuth();
  }, []);

  // Load Banner Ad
  useEffect(() => {
    if (!adLoaded) {
      loadBannerAd("#editProfileAd");
      setAdLoaded(true);
    }
  }, [adLoaded, loadBannerAd]);

  // Upload to Cloudinary
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET)
      throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );
    if (!res.ok) throw new Error("Cloudinary upload failed");

    const data = await res.json();
    return data.secure_url || data.url;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));
  };

  const handleProfileClick = () => {
    const choice = window.confirm(
      "Press OK to remove profile picture, Cancel to select a new one."
    );
    if (choice) {
      setProfilePic(null);
      setSelectedFile(null);
    } else {
      fileInputRef.current.click();
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let uploadedUrl = profilePic;
      if (selectedFile) uploadedUrl = await uploadToCloudinary(selectedFile);

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name,
        bio,
        profilePic: uploadedUrl || null,
        updatedAt: serverTimestamp(),
      });

      showPopup("✅ Profile updated!");
      navigate("/settings");
    } catch (err) {
      console.error(err);
      showPopup("❌ Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div
      style={{
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Scrollable Form */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {/* Back */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 16,
            cursor: "pointer",
            fontSize: 20,
            fontWeight: "bold",
          }}
          onClick={() => navigate("/settings")}
        >
          ← Back
        </div>

        <h2 style={{ textAlign: "center", marginBottom: 20 }}>Edit Profile</h2>

        <div
          style={{
            background: isDark ? "#2b2b2b" : "#fff",
            padding: 20,
            borderRadius: 12,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          {/* Profile Pic */}
          <div
            onClick={handleProfileClick}
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              background: profilePic ? `url(${profilePic}) center/cover` : "#888",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              color: "#fff",
              fontWeight: "bold",
              margin: "0 auto 20px",
            }}
            title="Click to change or remove profile picture"
          >
            {!profilePic && (name?.[0] || "U")}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginTop: 6 }}
            />
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 16 }}>
            <label>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginTop: 6 }}
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label>Email</label>
            <input
              type="text"
              value={email}
              readOnly
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
                marginTop: 6,
                background: isDark ? "#444" : "#eee",
                color: isDark ? "#ddd" : "#555",
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: "#007bff",
              color: "#fff",
              fontWeight: "bold",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Sticky Bottom Banner Ad */}
      <div
        id="editProfileAd"
        style={{
          width: "100%",
          maxWidth: 400,
          height: 60,
          margin: "0 auto",
          borderRadius: 12,
          overflow: "hidden",
          background: "#f0f0f0",
          position: "sticky",
          bottom: 0,
        }}
      ></div>
    </div>
  );
}