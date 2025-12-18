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
import confetti from "canvas-confetti";

import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import { useAd } from "../components/AdGateway";

// Settings modules
import AccountActionsSettings from "./SettingsPage/AccountActionsSettings";
import ApplicationPreferencesSettings from "./SettingsPage/ApplicationPreferencesSettings";
import DataAndStorageSettings from "./SettingsPage/DataAndStorageSettings";
import NotificationSettings from "./SettingsPage/NotificationSettings";
import PrivacyAndSecuritySettings from "./SettingsPage/PrivacyAndSecuritySettings";
import SupportAndAboutSettings from "./SettingsPage/SupportAndAboutSettings";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const backend = "https://smart-talk-zlxe.onrender.com";

/* ------------------ Animated Number ------------------ */
function useAnimatedNumber(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const raf = useRef(null);

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
  /* ------------------ Safe Contexts ------------------ */
  const themeCtx = useContext(ThemeContext);
  const theme = themeCtx?.theme || "light";
  const updateSettings = themeCtx?.updateSettings || (() => {});

  const popupCtx = usePopup();
  const showPopup = popupCtx?.showPopup || (() => {});

  const adCtx = useAd();
  const showRewarded =
    adCtx?.showRewarded || (async () => true);

  const navigate = useNavigate();
  const isDark = theme === "dark";

  /* ------------------ State ------------------ */
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [profilePic, setProfilePic] = useState(null);

  const [balance, setBalance] = useState(0);
  const animatedBalance = useAnimatedNumber(balance);
  const [transactions, setTransactions] = useState([]);

  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* ------------------ Auth + User ------------------ */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
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
          preferences: {
            notifications: true,
            language: "en",
          },
          createdAt: serverTimestamp(),
        });
      }

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const d = s.data();
        setName(d.name || "");
        setBio(d.bio || "");
        setProfilePic(d.profilePic || null);
      });

      await loadWallet(u.uid);
      return () => unsubSnap();
    });

    return () => unsub();
  }, []);

  const getToken = async () => auth.currentUser?.getIdToken(true);

  /* ------------------ Wallet ------------------ */
  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setBalance(data.balance || 0);
      setTransactions(data.transactions || []);
      setFlashReward(true);
      setTimeout(() => setFlashReward(false), 600);
    } catch {
      showPopup("Failed to load wallet");
    }
  };

  /* ------------------ Daily Reward ------------------ */
  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const d = new Date(t.createdAt || t.date);
    const today = new Date();
    d.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  const launchConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
    });
  };

  const handleDailyReward = async () => {
    if (!user || loadingReward || alreadyClaimed) return;

    setLoadingReward(true);
    try {
      await showRewarded("daily-reward", 15, () => true);

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
      if (!res.ok) throw new Error(data.error);

      await loadWallet(user.uid);
      showPopup("🎉 Daily reward claimed!");
      launchConfetti();
    } catch {
      showPopup("Failed to claim daily reward");
    } finally {
      setLoadingReward(false);
    }
  };

  /* ------------------ Upload ------------------ */
  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      { method: "POST", body: fd }
    );

    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.secure_url;
  };

  /* ------------------ Logout ------------------ */
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f6f6f6",
        color: isDark ? "#fff" : "#000",
      }}
    >
      <div onClick={() => navigate("/chat")} style={{ cursor: "pointer" }}>
        ← Back
      </div>

      <h2 style={{ textAlign: "center" }}>⚙️ Settings</h2>

      {/* Profile + Wallet */}
      <div style={card(isDark)}>
        <div
          onClick={() => navigate("/edit-profile")}
          style={avatar(profilePic)}
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h3>{name}</h3>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ marginLeft: "auto" }}
            >
              ⋮
            </button>
          </div>

          {menuOpen && (
            <div style={menu(isDark)}>
              <button onClick={() => navigate("/edit-profile")}>
                Edit Info
              </button>
              <button onClick={handleLogout}>Log Out</button>
            </div>
          )}

          <p style={{ opacity: 0.7 }}>{bio || "No bio yet"}</p>
          <p style={{ fontSize: 13 }}>{email}</p>

          <div onClick={() => navigate("/wallet")} style={wallet(isDark)}>
            <p>Balance</p>
            <strong
              style={{
                fontSize: 24,
                transform: flashReward ? "scale(1.15)" : "scale(1)",
                transition: "0.3s",
              }}
            >
              ${animatedBalance.toFixed(2)}
            </strong>

            <button
              disabled={loadingReward || alreadyClaimed}
              onClick={(e) => {
                e.stopPropagation();
                handleDailyReward();
              }}
              style={rewardBtn(alreadyClaimed)}
            >
              {alreadyClaimed ? "✅ Claimed" : "🧩 Daily Reward"}
            </button>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <AccountActionsSettings userId={user.uid} />
        <ApplicationPreferencesSettings userId={user.uid} />
        <DataAndStorageSettings userId={user.uid} />
        <NotificationSettings userId={user.uid} />
        <PrivacyAndSecuritySettings userId={user.uid} />
        <SupportAndAboutSettings />
      </div>
    </div>
  );
}

/* ------------------ Styles ------------------ */
const card = (dark) => ({
  display: "flex",
  gap: 16,
  padding: 16,
  background: dark ? "#2a2a2a" : "#fff",
  borderRadius: 12,
  marginBottom: 24,
});

const avatar = (pic) => ({
  width: 88,
  height: 88,
  borderRadius: "50%",
  background: pic ? `url(${pic}) center/cover` : "#777",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  color: "#fff",
  cursor: "pointer",
});

const wallet = (dark) => ({
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  background: dark ? "#1f1f1f" : "#eef6ff",
  cursor: "pointer",
});

const rewardBtn = (claimed) => ({
  marginTop: 10,
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "none",
  background: claimed ? "#666" : "#ffd700",
  cursor: claimed ? "not-allowed" : "pointer",
});

const menu = (dark) => ({
  position: "absolute",
  background: dark ? "#1c1c1c" : "#fff",
  borderRadius: 8,
  padding: 8,
});