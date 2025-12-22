// src/components/SettingsSidebar.jsx

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function SettingsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // List of settings links
  const links = [
    { label: "Account", path: "/settings/account" },
    { label: "Privacy", path: "/settings/privacy" },
    { label: "Notifications", path: "/settings/notifications" },
    { label: "Preferences", path: "/settings/preferences" },
    { label: "Data", path: "/settings/data" },
    { label: "Support", path: "/settings/support" },
  ];

  return (
    <div
      style={{
        width: 220,
        background: "#fff",
        padding: 20,
        borderRight: "1px solid #ddd",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {links.map((link) => {
        const isActive = location.pathname === link.path;
        return (
          <div
            key={link.path}
            onClick={() => navigate(link.path)}
            style={{
              cursor: "pointer",
              padding: "10px 15px",
              borderRadius: 6,
              background: isActive ? "#3b82f6" : "#f5f5f5",
              color: isActive ? "#fff" : "#000",
              fontWeight: isActive ? "bold" : "normal",
              boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.2)" : "none",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = !isActive ? "#e0e0e0" : "#3b82f6")}
            onMouseLeave={(e) => (e.currentTarget.style.background = isActive ? "#3b82f6" : "#f5f5f5")}
          >
            {link.label}
          </div>
        );
      })}
    </div>
  );
}