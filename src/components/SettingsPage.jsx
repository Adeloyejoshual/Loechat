// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";
import { useAd } from "../components/AdGateway";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Animated number hook
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
  const { theme, updateSettings, wallpaper } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const { showRewarded } = useAd();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const [balance, setBalance] = useState(0);
  const animatedBalance = useAnimatedNumber(balance);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("en");

  const profileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const isDark = theme === "dark";
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ------------------ Load user & wallet live ------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/");

      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: u.displayName || "User",
          bio: "",
          email: u.email || "",
          profilePic: null,
          preferences: { theme: "light", notifications: true, language: "en" },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        if (data.preferences) {
          setNotifications(data.preferences.notifications ?? true);
          setLanguage(data.preferences.language ?? "en");
        }
      });

      await loadWallet(u.uid);

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const getToken = async () => auth.currentUser.getIdToken(true);

  // ------------------ Wallet ------------------
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
        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 600);
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to load wallet. Check console.");
    }
  };

  // ------------------ Daily Reward ------------------
  const launchConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#ffd700", "#ff9800", "#00e676", "#007bff"],
    });
  };

  const alreadyClaimed = (() => {
    if (!transactions || transactions.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.some((t) => {
      if (t.type !== "checkin") return false;
      const txDate = new Date(t.createdAt || t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime();
    });
  })();

  const handleDailyReward = async () => {
    if (!user || loadingReward || alreadyClaimed) return;
    setLoadingReward(true);

    try {
      const adSuccess = await showRewarded(15, () => true);
      if (!adSuccess) {
        showPopup("Ad skipped. Reward not credited.");
        setLoadingReward(false);
        return;
      }

      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();

      if (res.ok) {
        await loadWallet(user.uid);
        showPopup("🎉 Daily reward claimed!");
        launchConfetti();
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ Already claimed today!");
      } else {
        showPopup(data.error || "Failed to claim daily reward.");
      }
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ------------------ Cloudinary Upload ------------------
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

  const onProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setProfilePic(URL.createObjectURL(file));

    try {
      const url = await uploadToCloudinary(file);
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
      setSelectedFile(null);
    } catch (err) {
      console.error("Upload failed:", err);
      showPopup("Failed to upload profile picture.");
    }
  };

  const onWallpaperChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const url = await uploadToCloudinary(file);
      await updateSettings(theme, url);
      showPopup("Wallpaper updated!");
    } catch (err) {
      console.error(err);
      showPopup("Failed to update wallpaper.");
    }
  };

  const toggleNotifications = async () => {
    const newValue = !notifications;
    setNotifications(newValue);
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { "preferences.notifications": newValue });
    }
  };

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    if (user) {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { "preferences.language": lang });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      {/* Back */}
      <div onClick={() => navigate("/chat")} style={{ display: "flex", alignItems: "center", marginBottom: 16, cursor: "pointer", color: isDark ? "#fff" : "#000", fontSize: 20, fontWeight: "bold" }}>
        ← Back
      </div>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* Profile + Wallet Panel */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: isDark ? "#2b2b2b" : "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.15)", marginBottom: 25, position: "relative" }}>
        <div onClick={() => navigate("/edit-profile")} style={{ width: 88, height: 88, borderRadius: 44, background: profilePic ? `url(${profilePic}) center/cover` : "#888", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "#fff", fontWeight: "bold" }}>
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>{name || "Unnamed User"}</h3>
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen((s) => !s)} style={{ border: "none", background: "transparent", color: isDark ? "#fff" : "#222", cursor: "pointer", fontSize: 20 }}>⋮</button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 34, background: isDark ? "#1a1a1a" : "#fff", color: isDark ? "#fff" : "#000", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,0.12)", overflow: "hidden", zIndex: 60, minWidth: 150 }}>
                  <button onClick={() => { navigate("/edit-profile"); setMenuOpen(false); }} style={menuItemStyle}>Edit Info</button>
                  <button onClick={handleLogout} style={menuItemStyle}>Log Out</button>
                </div>
              )}
            </div>
          </div>

          <p style={{ margin: "6px 0", color: isDark ? "#ccc" : "#555" }}>{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p style={{ margin: "0 0 12px", color: isDark ? "#bbb" : "#777", fontSize: 13 }}>{email}</p>

          {/* Wallet Panel */}
          <div onClick={() => navigate("/wallet")} style={{ padding: 16, background: isDark ? "#1f1f1f" : "#eef6ff", borderRadius: 12, cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}>
            <p style={{ margin: 0, fontSize: 16 }}>Balance:</p>
            <strong style={{ color: isDark ? "#00e676" : "#007bff", fontSize: 24, display: "inline-block", marginTop: 4, transition: "all 0.5s", transform: flashReward ? "scale(1.15)" : "scale(1)" }}>
              ${animatedBalance.toFixed(2)}
            </strong>
            <button onClick={(e) => { e.stopPropagation(); handleDailyReward(); }} disabled={loadingReward || alreadyClaimed} style={{ marginTop: 12, width: "100%", padding: "12px", borderRadius: 10, border: "none", background: alreadyClaimed ? "#666" : "#ffd700", color: "#000", fontWeight: "bold", fontSize: 14, cursor: alreadyClaimed ? "not-allowed" : "pointer", boxShadow: alreadyClaimed ? "none" : flashReward ? "0 0 15px 5px #ffd700" : "0 4px 8px rgba(255, 215, 0, 0.3)", transition: "all 0.3s" }}>
              {loadingReward ? "Processing..." : alreadyClaimed ? "✅ Already Claimed" : "🧩 Daily Reward (+$0.25)"}
            </button>
          </div>
        </div>
      </div>

      {/* ----------- Settings Toggles ----------- */}
      <div style={{ background: isDark ? "#2b2b2b" : "#fff", borderRadius: 12, padding: 16, boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
        <h3 style={{ marginBottom: 12 }}>Preferences</h3>

        {/* Theme Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span>Dark Mode</span>
          <input type="checkbox" checked={isDark} onChange={() => updateSettings(isDark ? "light" : "dark", wallpaper)} />
        </div>

        {/* Wallpaper Upload */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span>Change Wallpaper</span>
          <button onClick={() => wallpaperInputRef.current.click()} style={{ padding: "6px 12px", borderRadius: 6 }}>Upload</button>
          <input ref={wallpaperInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onWallpaperChange} />
        </div>

        {/* Notifications Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span>Notifications</span>
          <input type="checkbox" checked={notifications} onChange={toggleNotifications} />
        </div>

        {/* Language Selection */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span>Language</span>
          <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>
    </div>
  );
}

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
};