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

/* ================= ENV ================= */
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const BACKEND = "https://smart-talk-zlxe.onrender.com";

/* ================= Animated Number ================= */
function useAnimatedNumber(target, duration = 700) {
  const [value, setValue] = useState(target);
  const raf = useRef();

  useEffect(() => {
    const start = value;
    const diff = target - start;
    const startTime = performance.now();

    const step = (t) => {
      const p = Math.min((t - startTime) / duration, 1);
      setValue(start + diff * p);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return value;
}

/* ================= COMPONENT ================= */
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

  /* ================= AUTH + PROFILE ================= */
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) return navigate("/chat");

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
          createdAt: serverTimestamp(),
        });
      }

      loadWallet(u.uid);

      return onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const d = s.data();
        setName(d.name || "");
        setBio(d.bio || "");
        setProfilePic(d.profilePic || null);
      });
    });

    return () => unsub();
  }, []);

  /* ================= WALLET ================= */
  const getToken = () => auth.currentUser.getIdToken(true);

  const loadWallet = async (uid) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/wallet/${uid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      } else showPopup(data.error);
    } catch {
      showPopup("Failed to load wallet");
    }
  };

  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const d = new Date(t.createdAt || t.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const claimReward = async (e) => {
    e.stopPropagation();
    if (alreadyClaimed || loadingReward) return;

    setLoadingReward(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND}/api/wallet/daily`, {
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
        setTransactions((p) => [data.txn, ...p]);
        confetti({ particleCount: 120, spread: 90 });
        setFlashReward(true);
        setTimeout(() => setFlashReward(false), 500);
      } else showPopup(data.error);
    } finally {
      setLoadingReward(false);
    }
  };

  if (!user) return null;

  /* ================= SETTINGS LINKS ================= */
  const settingsLinks = [
    { name: "Account", path: "/settings/account" },
    { name: "Privacy", path: "/settings/privacy" },
    { name: "Notifications", path: "/settings/notifications" },
    { name: "Preferences", path: "/settings/preferences" },
    { name: "Data", path: "/settings/data" },
    { name: "Support", path: "/settings/support" },
  ];

  /* ================= UI ================= */
  return (
    <div
      style={{
        padding: 20,
        minHeight: "100vh",
        background: isDark ? "#1c1c1c" : "#f8f8f8",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Back */}
      <div
        onClick={() => navigate("/chat")}
        style={{ fontSize: 20, fontWeight: "bold", cursor: "pointer" }}
      >
        ← Back
      </div>

      <h2 style={{ textAlign: "center", margin: "16px 0" }}>⚙️ Settings</h2>

      {/* PROFILE */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          display: "flex",
          gap: 16,
          padding: 16,
          borderRadius: 14,
          background: isDark ? "#2b2b2b" : "#fff",
          marginBottom: 16,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: profilePic
              ? `url(${profilePic}) center/cover`
              : "#888",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 26,
            fontWeight: "bold",
          }}
        >
          {!profilePic && name[0]}
        </div>

        <div>
          <h3 style={{ margin: 0 }}>{name}</h3>
          <p style={{ margin: "4px 0", fontSize: 13, opacity: 0.8 }}>
            {bio || "No bio yet"}
          </p>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{email}</p>
        </div>
      </div>

      {/* WALLET */}
      <div
        onClick={() => navigate("/wallet")}
        style={{
          padding: 16,
          borderRadius: 14,
          background: isDark ? "#1f1f1f" : "#eef6ff",
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        <div>Balance</div>
        <div style={{ fontSize: 26, fontWeight: "bold" }}>
          ${animatedBalance.toFixed(2)}
        </div>

        <button
          onClick={claimReward}
          disabled={alreadyClaimed}
          style={{
            marginTop: 10,
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            background: alreadyClaimed ? "#666" : "#ffd700",
            fontWeight: "bold",
            boxShadow: flashReward
              ? "0 0 12px #ffd700"
              : "0 4px 8px rgba(0,0,0,0.2)",
          }}
        >
          {alreadyClaimed ? "Already Claimed" : "Daily Reward +$0.25"}
        </button>
      </div>

      {/* LINKS */}
      {settingsLinks.map((l) => (
        <button
          key={l.name}
          onClick={() => navigate(l.path)}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 8,
            borderRadius: 10,
            border: "none",
            textAlign: "left",
            background: isDark ? "#2b2b2b" : "#fff",
            color: isDark ? "#fff" : "#000",
            fontWeight: 500,
          }}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}