// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate, Outlet } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

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

// Transparent SVG icons
const icons = {
  Account: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
    </svg>
  ),
  Privacy: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l7 5v6c0 5-4 9-7 9s-7-4-7-9v-6l7-5z" />
    </svg>
  ),
  Notifications: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 24c1.3 0 2.4-1 2.4-2.3h-4.8c0 1.3 1.1 2.3 2.4 2.3zm6-6v-5c0-3.3-2.7-6-6-6s-6 2.7-6 6v5l-2 2v1h16v-1l-2-2z" />
    </svg>
  ),
  Preferences: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.4 12c0-.7-.1-1.3-.2-2l2.1-1.6-2-3.4-2.5 1c-.6-.5-1.3-.9-2-.9-.7 0-1.4.3-2 .9l-2.5-1-2 3.4 2.1 1.6c-.1.7-.2 1.3-.2 2s.1 1.3.2 2l-2.1 1.6 2 3.4 2.5-1c.6.5 1.3.9 2 .9.7 0 1.4-.3 2-.9l2.5 1 2-3.4-2.1-1.6c.1-.7.2-1.3.2-2z" />
    </svg>
  ),
  Data: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 3h16v2H4V3zm0 6h16v2H4V9zm0 6h10v2H4v-2z" />
    </svg>
  ),
  Support: (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 17h-2v-2h2v2zm1.1-7.7l-.9.9c-.3.3-.4.6-.4 1v.8h-2v-.8c0-.9.4-1.5 1-2l1.1-1.1c.2-.2.3-.5.3-.8 0-.6-.5-1-1-1s-1 .5-1 1H9c0-1.6 1.3-3 3-3s3 1.4 3 3c0 .7-.3 1.3-.9 1.7z" />
    </svg>
  ),
};

export default function SettingsPage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();

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

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";
  const backend = "https://smart-talk-zlxe.onrender.com";

  // Load user & wallet
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
          preferences: { theme: "light" },
          createdAt: serverTimestamp(),
        });
      }
      onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      });
      loadWallet(u.uid);
    });
    return () => unsub();
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

  const handleDailyReward = async () => {
    if (!user || loadingReward) return;
    setLoadingReward(true);
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/api/wallet/daily`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 0.25 }),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 600);
      } else showPopup(data.error || "Failed to claim daily reward.");
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
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

  const uploadToCloudinary = async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    return data.secure_url || data.url;
  };

  const onProfileFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadToCloudinary(file);
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), { profilePic: url, updatedAt: serverTimestamp() });
      setProfilePic(url);
    } catch (err) {
      console.error(err);
      alert("Failed to upload profile picture.");
    }
  };

  if (!user) return <p>Loading user...</p>;

  const settingsLinks = ["Account", "Privacy", "Notifications", "Preferences", "Data", "Support"];

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Profile + Wallet */}
      <div
        style={{
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transition: "all 0.3s",
        }}
      >
        {/* Profile */}
        <div
          onClick={() => profileInputRef.current.click()}
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: profilePic ? `url(${profilePic}) center/cover` : "#777",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            fontWeight: "bold",
            color: "#fff",
            cursor: "pointer",
            transition: "transform 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {!profilePic && name?.[0]}
        </div>

        <h3 style={{ marginTop: 12 }}>{name}</h3>
        <p style={{ fontSize: 13, opacity: 0.7 }}>{email}</p>

        {/* Wallet */}
        <div
          style={{
            marginTop: 16,
            width: "100%",
            padding: 16,
            borderRadius: 12,
            background: isDark ? "#1f1f1f" : "#eef4ff",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.3s, box-shadow 0.3s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.boxShadow = `0 0 15px 5px ${isDark ? "#00e676" : "#007bff"}`)
          }
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
          onClick={() => navigate("/wallet")}
        >
          <p style={{ margin: 0, fontSize: 16 }}>Balance</p>
          <strong style={{ fontSize: 24, color: isDark ? "#00e676" : "#007bff" }}>
            ${animatedBalance.toFixed(2)}
          </strong>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDailyReward();
            }}
            disabled={loadingReward || alreadyClaimed}
            style={{
              marginTop: 12,
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "none",
              background: alreadyClaimed ? "#666" : "#ffd700",
              fontWeight: "bold",
              cursor: alreadyClaimed ? "not-allowed" : "pointer",
              transition: "all 0.3s",
              boxShadow: flashReward ? "0 0 15px 5px #ffd700" : "none",
            }}
          >
            {loadingReward
              ? "Processing..."
              : alreadyClaimed
              ? "✅ Already Claimed"
              : "🧩 Daily Reward (+$0.25)"}
          </button>
        </div>
      </div>

      <input
        ref={profileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onProfileFileChange}
      />

      {/* Settings Links */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {settingsLinks.map((name) => (
          <button
            key={name}
            onClick={() => navigate(`/settings/${name.toLowerCase()}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 12,
              borderRadius: 8,
              border: "none",
              background: isDark ? "#2b2b2b" : "#fff",
              color: isDark ? "#fff" : "#000",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.opacity = 0.9;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.opacity = 1;
            }}
          >
            <span style={{ opacity: 0.6 }}>{icons[name]}</span>
            {name}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <Outlet />
      </div>
    </div>
  );
}