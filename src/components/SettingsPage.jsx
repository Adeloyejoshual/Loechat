// src/components/SettingsPage.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
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
      if (!u) return navigate("/chat");

      setUser(u);
      setEmail(u.email || "");

      // Load wallet
      loadWallet(u.uid);

      const userRef = doc(db, "users", u.uid);

      // Ensure user doc exists
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

      // Live snapshot for profile
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

  const launchConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#ffd700", "#ff9800", "#00e676", "#007bff"],
    });
  };

  const handleDailyReward = async () => {
    if (!user || loadingReward) return;
    setLoadingReward(true);

    try {
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
        setBalance(data.balance);
        setTransactions((prev) => [data.txn, ...prev]);
        showPopup("🎉 Daily reward claimed!");
        launchConfetti();

        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 600);
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
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

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/chat");
  };

  if (!user) return <p>Loading user...</p>;

  // ================== SETTINGS LINKS ==================
  const settingsLinks = [
    { name: "Account", path: "/settings/account" },
    { name: "Privacy", path: "/settings/privacy" },
    { name: "Notifications", path: "/settings/notifications" },
    { name: "Preferences", path: "/settings/preferences" },
    { name: "Data", path: "/settings/data" },
    { name: "Support", path: "/settings/support" },
  ];

  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Back Arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
          cursor: "pointer",
          color: isDark ? "#fff" : "#000",
          fontSize: 20,
          fontWeight: "bold",
        }}
        onClick={() => navigate("/chat")}
        title="Back to Chat"
      >
        ← Back
      </div>

      <h2 style={{ textAlign: "center", marginBottom: 20 }}>⚙️ Settings</h2>

      {/* ================= Profile Card ================= */}
      <div
        onClick={() => navigate("/user-profile")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: isDark ? "#2b2b2b" : "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          marginBottom: 20,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            background: profilePic ? `url(${profilePic}) center/cover` : "#888",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 20 }}>{name || "Unnamed User"}</h3>
          <p style={{ margin: "4px 0", color: isDark ? "#ccc" : "#555", fontSize: 13 }}>
            {bio || "No bio yet"}
          </p>
          <p style={{ margin: 0, color: isDark ? "#bbb" : "#777", fontSize: 12 }}>{email}</p>
        </div>
      </div>

      {/* ================= Wallet Panel ================= */}
      <div
        onClick={() => navigate("/wallet")}
        style={{
          padding: 16,
          background: isDark ? "#1f1f1f" : "#eef6ff",
          borderRadius: 12,
          cursor: "pointer",
          transition: "transform 0.2s",
          marginBottom: 25,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <p style={{ margin: 0, fontSize: 16 }}>Balance:</p>
        <strong
          style={{
            color: isDark ? "#00e676" : "#007bff",
            fontSize: 24,
            display: "inline-block",
            marginTop: 4,
            transition: "all 0.5s",
          }}
        >
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
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: alreadyClaimed ? "#666" : "#ffd700",
            color: "#000",
            fontWeight: "bold",
            fontSize: 14,
            cursor: alreadyClaimed ? "not-allowed" : "pointer",
            boxShadow: alreadyClaimed
              ? "none"
              : flashReward
              ? "0 0 15px 5px #ffd700"
              : "0 4px 8px rgba(255, 215, 0, 0.3)",
            transition: "all 0.3s",
          }}
        >
          {loadingReward
            ? "Processing..."
            : alreadyClaimed
            ? "✅ Already Claimed"
            : "🧩 Daily Reward (+$0.25)"}
        </button>
      </div>

      {/* ================= Settings Links ================= */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {settingsLinks.map((item) => (
          <button
            key={item.name}
            onClick={() => navigate(item.path)}
            style={{
              padding: "12px",
              textAlign: "left",
              borderRadius: 8,
              border: "none",
              background: isDark ? "#2b2b2b" : "#fff",
              color: isDark ? "#fff" : "#000",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* Render sub-pages */}
      <div style={{ marginTop: 24 }}>
        <Outlet />
      </div>
    </div>
  );
}

/* Styles */
const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 12px",
  background: "transparent",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
};