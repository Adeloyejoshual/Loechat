import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  updateEmail,
  updatePassword,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
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
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [saving, setSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");

  // Delete
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  // ---------------- AUTH + LOAD PROFILE ----------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        navigate("/");
        return;
      }

      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);

      (async () => {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || "");
          setBio(data.bio || "");
          setProfilePic(data.profilePic || null);
        }
      })();
    });

    return () => unsubAuth();
  }, []);

  // ---------------- CLOUDINARY ----------------
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

    if (!res.ok) throw new Error("Upload failed");

    const data = await res.json();
    return data.secure_url || data.url;
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setProfilePic(URL.createObjectURL(file));

    try {
      const url = await uploadToCloudinary(file);
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        profilePic: url,
        updatedAt: serverTimestamp(),
      });
      setProfilePic(url);
      showPopup("✅ Profile image updated");
    } catch {
      showPopup("❌ Image upload failed");
    }
  };

  // ---------------- SAVE PROFILE ----------------
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        name,
        bio,
        email,
        updatedAt: serverTimestamp(),
      });

      if (email !== user.email) {
        await updateEmail(user, email);
      }

      showPopup("✅ Profile updated");
      navigate("/settings");
    } catch {
      showPopup("❌ Update failed");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- CHANGE PASSWORD ----------------
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      return showPopup("❌ Password must be at least 6 characters");
    }

    try {
      await updatePassword(user, newPassword);
      setNewPassword("");
      showPopup("✅ Password changed successfully");
    } catch {
      showPopup("❌ Login again to change password");
    }
  };

  // ---------------- DELETE ACCOUNT ----------------
  const handleDeleteAccount = async () => {
    if (!confirmPassword) {
      return showPopup("❌ Enter your password to confirm");
    }

    try {
      setDeleting(true);

      const credential = EmailAuthProvider.credential(
        user.email,
        confirmPassword
      );

      await reauthenticateWithCredential(user, credential);

      await deleteDoc(doc(db, "users", user.uid)); // Firestore
      await deleteUser(user); // Firebase Auth

      showPopup("✅ Account deleted permanently");
      navigate("/");
    } catch {
      showPopup("❌ Incorrect password or re-auth failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      <div
        onClick={() => navigate("/settings")}
        style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16 }}
      >
        ← Back
      </div>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>✏️ Edit Profile</h2>

      {/* Profile Image */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          onClick={() => fileInputRef.current.click()}
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            margin: "0 auto",
            background: profilePic ? `url(${profilePic}) center/cover` : "#888",
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

      <div style={cardStyle}>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

        <label>Bio</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} style={{ ...inputStyle, height: 80 }} />

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

        <button onClick={handleSave} style={saveBtn} disabled={saving}>
          {saving ? "Saving..." : "✅ Save Changes"}
        </button>
      </div>

      {/* ===== CHANGE PASSWORD ===== */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <h3>🔐 Change Password</h3>
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleChangePassword} style={passwordBtn}>
          Update Password
        </button>
      </div>

      {/* ===== DELETE ACCOUNT ===== */}
      <div style={{ ...cardStyle, marginTop: 20, border: "2px solid red" }}>
        <h3 style={{ color: "red" }}>⚠️ Delete Account</h3>
        <input
          type="password"
          placeholder="Enter password to confirm"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleDeleteAccount} style={deleteBtn} disabled={deleting}>
          {deleting ? "Deleting..." : "❌ Delete My Account"}
        </button>
      </div>
    </div>
  );
}

// ================= STYLES =================

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

const passwordBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "#007bff",
  color: "#fff",
};

const deleteBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "red",
  color: "#fff",
  fontWeight: "bold",
};