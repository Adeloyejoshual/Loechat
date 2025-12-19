// src/components/SettingsPage.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";

// ------------------- Animated Number Hook -------------------
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

// ------------------- Individual Setting Item -------------------
const SettingItem = ({ title, subtitle, onClick, dark }) => (
  <button
    onClick={onClick}
    className="w-full text-left px-4 py-3 rounded-lg transition flex flex-col"
    style={{
      background: dark ? "#2a2a2a" : "#fff",
      color: dark ? "#fff" : "#000",
      boxShadow: dark ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.1)",
    }}
  >
    <span style={{ fontWeight: "600" }}>{title}</span>
    <small style={{ opacity: 0.7 }}>{subtitle}</small>
  </button>
);

// ------------------- Settings Page -------------------
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

  const [balance, setBalance] = useState(0);
  const animatedBalance = useAnimatedNumber(balance);
  const [transactions, setTransactions] = useState([]);
  const [loadingReward, setLoadingReward] = useState(false);
  const [flashReward, setFlashReward] = useState(false);

  const backend = "https://smart-talk-zlxe.onrender.com";

  // ------------------- Auth + User -------------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        navigate("/");
        return;
      }

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

      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
      });

      loadWallet(u.uid);

      return () => unsubSnap();
    });

    return () => unsubAuth();
  }, []);

  const getToken = async () => auth.currentUser?.getIdToken(true);

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
      } else showPopup(data.error || "Failed to load wallet.");
    } catch {
      showPopup("Failed to load wallet. Check console.");
    }
  };

  // ------------------- Daily Reward -------------------
  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const txDate = new Date(t.createdAt || t.date);
    const today = new Date();
    txDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return txDate.getTime() === today.getTime();
  });

  const launchConfetti = () => {
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
  };

  const handleDailyReward = async () => {
    if (!user || loadingReward || alreadyClaimed) return;
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
        launchConfetti();
        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 600);
      } else if (data.error?.toLowerCase().includes("already claimed")) {
        showPopup("✅ You already claimed today's reward!");
      } else {
        showPopup(data.error || "Failed to claim daily reward.");
      }
    } catch {
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8" }}>
      {/* Back Button */}
      <div
        onClick={() => navigate("/chat")}
        style={{ cursor: "pointer", marginBottom: 16, fontSize: 20 }}
      >
        ← Back
      </div>

      {/* Profile + Wallet Panel */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          borderRadius: 12,
          background: isDark ? "#2b2b2b" : "#fff",
          marginBottom: 24,
        }}
      >
        <div
          onClick={() => navigate("/edit-profile")}
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: profilePic ? `url(${profilePic}) center/cover` : "#888",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 28,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {!profilePic && (name?.[0] || "U")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{name || "Unnamed User"}</h3>
          <p style={{ margin: "4px 0", opacity: 0.7 }}>{bio || "No bio yet"}</p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>{email}</p>

          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: isDark ? "#1f1f1f" : "#eef6ff",
              cursor: "pointer",
            }}
            onClick={() => navigate("/wallet")}
          >
            <p style={{ margin: 0 }}>Balance</p>
            <strong style={{ fontSize: 24, color: isDark ? "#00e676" : "#007bff" }}>
              ${animatedBalance.toFixed(2)}
            </strong>

            <button
              disabled={loadingReward || alreadyClaimed}
              onClick={(e) => {
                e.stopPropagation();
                handleDailyReward();
              }}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                background: alreadyClaimed ? "#666" : "#ffd700",
                cursor: alreadyClaimed ? "not-allowed" : "pointer",
                fontWeight: "bold",
              }}
            >
              {alreadyClaimed ? "✅ Claimed" : "🧩 Daily Reward (+$0.25)"}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Navigation */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SettingItem
          title="Application Preferences"
          subtitle="Theme, language, app behavior"
          onClick={() => navigate("/settings/app-preferences")}
          dark={isDark}
        />
        <SettingItem
          title="Data & Storage"
          subtitle="Cache, downloads, usage"
          onClick={() => navigate("/settings/data-storage")}
          dark={isDark}
        />
        <SettingItem
          title="Notifications"
          subtitle="Sounds, messages, alerts"
          onClick={() => navigate("/settings/notifications")}
          dark={isDark}
        />
        <SettingItem
          title="Privacy & Security"
          subtitle="Blocked users, security"
          onClick={() => navigate("/settings/privacy-security")}
          dark={isDark}
        />
        <SettingItem
          title="Support & About"
          subtitle="Help, app info"
          onClick={() => navigate("/settings/support")}
          dark={isDark}
        />
      </div>
    </div>
  );
}