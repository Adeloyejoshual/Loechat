import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { ThemeContext } from "../context/ThemeContext";

// Icons
import {
  ArrowLeftIcon,
  LockClosedIcon,
  BellIcon,
  Cog6ToothIcon,
  CloudArrowDownIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === "dark";

  const [userData, setUserData] = useState(null);

  // ---------------- LOAD USER ----------------
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid);
    getDoc(ref).then((snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
  }, []);

  // ---------------- MENU ----------------
  const menuItems = [
    {
      label: "Privacy & Security",
      icon: LockClosedIcon,
      path: "/settings/privacy",
    },
    {
      label: "Notifications",
      icon: BellIcon,
      path: "/settings/notifications",
    },
    {
      label: "Application Preferences",
      icon: Cog6ToothIcon,
      path: "/settings/preferences",
    },
    {
      label: "Data & Storage",
      icon: CloudArrowDownIcon,
      path: "/settings/data",
    },
    {
      label: "Support & About",
      icon: QuestionMarkCircleIcon,
      path: "/settings/support",
    },
    {
      label: "Account Actions",
      icon: ExclamationTriangleIcon,
      path: "/settings/account",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark ? "#18181b" : "#f3f4f6",
        color: isDark ? "#fff" : "#000",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px",
        }}
      >
        <ArrowLeftIcon
          onClick={() => navigate("/chat")}
          style={{ width: 24, height: 24, cursor: "pointer" }}
        />
        <h1 style={{ fontSize: 22, fontWeight: "bold" }}>Settings</h1>
      </div>

      {/* Profile Preview */}
      <div
        onClick={() => navigate("/edit-profile")}
        style={{
          margin: "0 16px 20px",
          background: isDark ? "#27272a" : "#fff",
          borderRadius: 14,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,.15)",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: userData?.profilePic
              ? `url(${userData.profilePic}) center/cover`
              : "#3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: "bold",
            color: "#fff",
          }}
        >
          {!userData?.profilePic && userData?.name?.[0]}
        </div>

        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>
            {userData?.name || "User"}
          </p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Tap to edit profile
          </p>
        </div>

        <ChevronRightIcon style={{ width: 20, height: 20, opacity: 0.6 }} />
      </div>

      {/* Settings Menu */}
      <div style={{ margin: "0 16px" }}>
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              width: "100%",
              border: "none",
              background: isDark ? "#27272a" : "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,.12)",
              color: isDark ? "#fff" : "#000",
            }}
          >
            <item.icon style={{ width: 22, height: 22, opacity: 0.8 }} />
            <span style={{ flex: 1, textAlign: "left", fontSize: 15 }}>
              {item.label}
            </span>
            <ChevronRightIcon style={{ width: 18, height: 18, opacity: 0.5 }} />
          </button>
        ))}
      </div>
    </div>
  );
}