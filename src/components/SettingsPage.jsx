// src/components/SettingsPage.jsx
import React, { useEffect, useState, useRef, useMemo, useContext } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { usePopup } from "../context/PopupContext";
import confetti from "canvas-confetti";

// Modular SettingsPage Components
import PrivacyAndSecuritySettings from "./SettingsPage/PrivacyAndSecuritySettings";
import NotificationSettings from "./SettingsPage/NotificationSettings";
import ApplicationPreferencesSettings from "./SettingsPage/ApplicationPreferencesSettings";
import DataAndStorageSettings from "./SettingsPage/DataAndStorageSettings";
import SupportAndAboutSettings from "./SettingsPage/SupportAndAboutSettings";
import AccountActionsSettings from "./SettingsPage/AccountActionsSettings";

import {
  LockClosedIcon,
  BellIcon,
  Cog6ToothIcon,
  CloudArrowDownIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

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

// ===== Interstitial Ad =====
const showInterstitialAd = () => {
  const adContainer = document.createElement("ins");
  adContainer.className = "adsbygoogle";
  adContainer.style.display = "block";
  adContainer.setAttribute("data-ad-client", "ca-pub-3218753156748504");
  adContainer.setAttribute("data-ad-slot", "7639678257");
  adContainer.setAttribute("data-ad-format", "auto");
  adContainer.setAttribute("data-full-width-responsive", "true");

  document.body.appendChild(adContainer);
  (adsbygoogle = window.adsbygoogle || []).push({});
};

// ===== Sidebar Sections =====
const sections = [
  { id: "privacy", label: "Privacy & Security", icon: <LockClosedIcon className="w-5 h-5 mr-2" /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon className="w-5 h-5 mr-2" /> },
  { id: "preferences", label: "Application Preferences", icon: <Cog6ToothIcon className="w-5 h-5 mr-2" /> },
  { id: "data", label: "Data & Storage", icon: <CloudArrowDownIcon className="w-5 h-5 mr-2" /> },
  { id: "support", label: "Support & About", icon: <QuestionMarkCircleIcon className="w-5 h-5 mr-2" /> },
  { id: "account", label: "Account Actions", icon: <ExclamationTriangleIcon className="w-5 h-5 mr-2" /> },
];

export default function SettingsPage() {
  const { theme, setTheme } = useContext(ThemeContext);
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

  const [activeSection, setActiveSection] = useState("privacy");

  const profileInputRef = useRef(null);
  const isDark = theme === "dark";
  const backend = "https://smart-talk-zlxe.onrender.com";

  // ----------------- Auth + User Data -----------------
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (!u) {
        navigate("/");
        return;
      }

      setUser(u);
      setEmail(u.email || "");

      const userRef = doc(db, "users", u.uid);

      // Async create doc if missing
      (async () => {
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
      })();

      // Live snapshot for profile
      const unsubSnap = onSnapshot(userRef, (s) => {
        if (!s.exists()) return;
        const data = s.data();
        setName(data.name || "");
        setBio(data.bio || "");
        setProfilePic(data.profilePic || null);
        // Live theme sync
        if (data.preferences?.theme && data.preferences.theme !== theme) {
          setTheme(data.preferences.theme);
        }
      });

      loadWallet(u.uid);

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

  const alreadyClaimed = useMemo(() => {
    if (!transactions || transactions.length === 0) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.some((t) => {
      if (t.type !== "checkin") return false;
      const txDate = new Date(t.createdAt || t.date);
      txDate.setHours(0, 0, 0, 0);
      return txDate.getTime() === today.getTime();
    });
  }, [transactions]);

  const launchConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#ffd700", "#ff9800", "#00e676", "#007bff"],
    });
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
    } catch (err) {
      console.error(err);
      showPopup("Failed to claim daily reward. Check console.");
    } finally {
      setLoadingReward(false);
    }
  };

  // ----------------- Cloudinary Upload -----------------
  const uploadToCloudinary = async (file) => {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error("Cloudinary environment not set");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: fd,
    });
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

  const userId = user?.uid;

  const renderActiveSection = () => {
    switch (activeSection) {
      case "privacy":
        return <PrivacyAndSecuritySettings userId={userId} />;
      case "notifications":
        return <NotificationSettings userId={userId} />;
      case "preferences":
        return <ApplicationPreferencesSettings userId={userId} />;
      case "data":
        return <DataAndStorageSettings userId={userId} />;
      case "support":
        return <SupportAndAboutSettings userId={userId} />;
      case "account":
        return <AccountActionsSettings userId={userId} />;
      default:
        return null;
    }
  };

  if (!user) return <p>Loading user...</p>;

  return (
    <div className={`min-h-screen p-6 sm:p-10 ${isDark ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"} flex flex-col lg:flex-row`}>
      {/* Sidebar */}
      <aside className="w-full lg:w-1/4 mb-6 lg:mb-0">
        {/* Profile Card */}
        <div className={`flex flex-col items-center gap-4 p-4 rounded-2xl shadow-md mb-6 ${isDark ? "bg-gray-800" : "bg-white"}`}>
          <div
            className="w-24 h-24 rounded-full bg-gray-500 flex items-center justify-center cursor-pointer text-2xl font-bold text-white"
            style={{ backgroundImage: profilePic ? `url(${profilePic})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
            onClick={() => profileInputRef.current?.click()}
          >
            {!profilePic && (name?.[0] || "U")}
          </div>
          <h3 className="text-xl font-semibold">{name || "Unnamed User"}</h3>
          <p className="text-sm text-gray-400 text-center">{bio || "No bio yet — click ⋮ → Edit Info to add one."}</p>
          <p className="text-xs text-gray-500">{email}</p>
          <div
            className={`w-full p-3 mt-2 rounded-lg ${isDark ? "bg-gray-700" : "bg-blue-50"} cursor-pointer`}
            onClick={() => navigate("/wallet")}
          >
            <p className="text-sm">Balance:</p>
            <strong className={`${isDark ? "text-green-400" : "text-blue-600"} text-2xl`}>${animatedBalance.toFixed(2)}</strong>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDailyReward();
              }}
              disabled={loadingReward || alreadyClaimed}
              className={`mt-2 w-full py-2 rounded-lg font-bold ${alreadyClaimed ? "bg-gray-600 cursor-not-allowed" : "bg-yellow-400 hover:bg-yellow-300"} text-black transition`}
            >
              {loadingReward ? "Processing..." : alreadyClaimed ? "✅ Already Claimed" : "🧩 Daily Reward (+$0.25)"}
            </button>
          </div>
        </div>

        {/* Sidebar Menu */}
        <ul className="space-y-3">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={`flex items-center w-full text-left px-4 py-2 rounded-lg transition ${
                  activeSection === section.id
                    ? "bg-blue-500 text-white"
                    : "bg-white hover:bg-gray-100 text-gray-700"
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 transition-all duration-300">{renderActiveSection()}</main>

      <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={onProfileFileChange} />
    </div>
  );
}