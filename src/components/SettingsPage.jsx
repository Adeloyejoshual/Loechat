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

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// Animated balance hook
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

// Section wrapper
function Section({ title, children }) {
  return (
    <div
      style={{
        marginBottom: 24,
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

// Simple setting row
function SettingRow({ title, desc, action, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #eee",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{title}</strong>
          {desc && <p style={{ margin: "4px 0", color: "#666" }}>{desc}</p>}
        </div>
        {action && <span style={{ color: "#007bff" }}>{action}</span>}
      </div>
    </div>
  );
}

// Toggle row
function ToggleRow({ title, initial = true, onToggle }) {
  const [on, setOn] = useState(initial);
  const toggle = () => {
    setOn(!on);
    onToggle?.(!on);
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
        borderBottom: "1px solid #eee",
      }}
    >
      <span>{title}</span>
      <input type="checkbox" checked={on} onChange={toggle} />
    </div>
  );
}

export default function SettingsPage() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();
  const navigate = useNavigate();

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
  const isDark = theme === "dark";
  const backend = "https://smart-talk-zlxe.onrender.com";

  // Load user + wallet
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
      } else {
        showPopup(data.error || "Failed to load wallet.");
      }
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
      alert("Failed to upload profile picture.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ padding: 20, minHeight: "100vh", background: isDark ? "#1c1c1c" : "#f8f8f8", color: isDark ? "#fff" : "#000" }}>
      {/* Header */}
      <div style={{ cursor: "pointer", marginBottom: 16, fontWeight: "bold" }} onClick={() => navigate("/chat")}>
        ← Back
      </div>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>⚙️ Settings</h2>

      {/* ================= PROFILE + WALLET ================= */}
      <Section title="👤 Profile">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
          <div style={{ flex: 1 }}>
            <h3>{name || "Unnamed User"}</h3>
            <p style={{ margin: "4px 0", color: "#666" }}>{bio || "No bio yet"}</p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>{email}</p>

            {/* Wallet */}
            <div style={{ padding: 12, background: "#eef6ff", borderRadius: 8, cursor: "pointer" }} onClick={() => navigate("/wallet")}>
              <p style={{ margin: 0 }}>Balance:</p>
              <strong style={{ fontSize: 20, color: "#007bff" }}>${animatedBalance.toFixed(2)}</strong>
              <button
                onClick={(e) => { e.stopPropagation(); handleDailyReward(); }}
                disabled={loadingReward || alreadyClaimed}
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "none",
                  background: alreadyClaimed ? "#ccc" : "#ffd700",
                  fontWeight: "bold",
                  cursor: alreadyClaimed ? "not-allowed" : "pointer",
                }}
              >
                {loadingReward ? "Processing..." : alreadyClaimed ? "✅ Claimed" : "🧩 Daily Reward (+$0.25)"}
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* ================= PRIVACY ================= */}
      <Section title="🔒 Privacy">
        <SettingRow title="Last Seen" desc="Control who can see your last seen" action="Everyone" />
        <SettingRow title="Profile Photo" desc="Who can see your profile photo" action="My Contacts" />
        <SettingRow title="Blocked Users" desc="Manage blocked accounts" onClick={() => navigate("/blocked")} />
      </Section>

      {/* ================= NOTIFICATIONS ================= */}
      <Section title="🔔 Notifications">
        <ToggleRow title="Message Notifications" />
        <ToggleRow title="Group Notifications" />
        <ToggleRow title="Sound" />
      </Section>

      {/* ================= PREFERENCES ================= */}
      <Section title="🎨 Preferences">
        <SettingRow title="Theme" desc="Light / Dark mode" action={isDark ? "Dark" : "Light"} />
        <SettingRow title="Language" desc="English" />
      </Section>

      {/* ================= DATA ================= */}
      <Section title="💾 Data">
        <SettingRow title="Storage Usage" />
        <SettingRow title="Clear Cache" />
      </Section>

      {/* ================= SUPPORT ================= */}
      <Section title="🆘 Support">
        <SettingRow title="Help Center" />
        <SettingRow title="Contact Support" />
        <SettingRow title="About App" />
      </Section>

      {/* Hidden Cloudinary file input */}
      <input ref={profileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onProfileFileChange} />
    </div>
  );
}