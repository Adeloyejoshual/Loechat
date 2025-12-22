// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate, Outlet } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ====== Hook for animated number ======
function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const raf = useRef();
  useEffect(() => {
    const start = display;
    const diff = target - start;
    const startTime = performance.now();
    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      setDisplay(start + diff * progress);
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return display;
}

export default function SettingsPage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [balance, setBalance] = useState(0);
  const animatedBalance = useAnimatedNumber(balance, 800);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profileInputRef = useRef(null);
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ================== Load User + Wallet ==================
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");

      setUser(u);
      setEmail(u.email || "");
      loadWallet(u.uid);

      const userRef = doc(db, "users", u.uid);

      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      });

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);

  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else showPopup(data.error || "Failed to load wallet.");
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet. Check console.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // ================== SETTINGS LINKS ==================
  const settingsLinks = [
    { name: "Account", path: "/settings/account" },
    { name: "Privacy", path: "/settings/privacy" },
    { name: "Notifications", path: "/settings/notifications" },
    { name: "Preferences", path: "/settings/preferences" },
    { name: "Data", path: "/settings/data" },
    { name: "Support", path: "/settings/support" },
  ];

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8" }}>
      {/* Sidebar / Settings Navigation */}
      <div
        style={{
          width: 220,
          padding: 20,
          borderRight: isDark ? "1px solid #333" : "1px solid #ccc",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Profile Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexDirection: "column",
            background: isDark ? "#2b2b2b" : "#fff",
            padding: 16,
            borderRadius: 12,
          }}
        >
          <div
            onClick={() => navigate("/edit-profile")}
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
            }}
            title="Click to edit profile"
          >
            {!profilePic && (name?.[0] || "U")}
          </div>
          <h3 style={{ margin: 8 }}>{name}</h3>
          <p style={{ fontSize: 12, textAlign: "center" }}>{email}</p>
          <div
            style={{
              marginTop: 8,
              padding: 8,
              background: isDark ? "#1f1f1f" : "#eef6ff",
              borderRadius: 8,
              width: "100%",
              textAlign: "center",
            }}
          >
            Balance: <strong>${animatedBalance.toFixed(2)}</strong>
          </div>
        </div>

        {/* Settings Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {settingsLinks.map((item) => (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              style={{
                padding: "10px 14px",
                textAlign: "left",
                borderRadius: 8,
                border: "none",
                background: isDark ? "#2b2b2b" : "#fff",
                color: isDark ? "#fff" : "#000",
                cursor: "pointer",
                fontWeight: "500",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content / Outlet */}
      <div style={{ flex: 1, padding: 24 }}>
        <Outlet />
      </div>
    </div>
  );
}