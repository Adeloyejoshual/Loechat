// src/components/settings/ProfileSettings.jsx
import React, { useEffect, useState, useContext, useRef } from "react";
import { auth, db } from "../../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { ThemeContext } from "../../context/ThemeContext";
import { usePopup } from "../../context/PopupContext";
import confetti from "canvas-confetti";

// Cloudinary env
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// ===== Hook for animated number =====
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

export default function ProfileSettings() {
  const { theme } = useContext(ThemeContext);
  const { showPopup } = usePopup();

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

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ================= Load User + Wallet =================
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) return;

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

  // ================= Daily Reward =================
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

  const alreadyClaimed = transactions.some((t) => {
    if (t.type !== "checkin") return false;
    const txDate = new Date(t.createdAt || t.date);
    txDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return txDate.getTime() === today.getTime();
  });

  // ================= Cloudinary Upload =================
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

  if (!user) return <p>Loading user...</p>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {/* Profile + Wallet panel here */}
      {/* Copy your old JSX for profile and wallet panel */}
      {/* Add profile picture, name, bio, balance, daily reward button */}
    </div>
  );
}