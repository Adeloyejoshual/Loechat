import React from "react";
import SettingsSidebar from "./SettingsSidebar";

export default function SettingsPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f9f9f9" }}>
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Main Content Placeholder */}
      <div style={{ flex: 1, padding: 30 }}>
        <h2>Settings</h2>
        <p>Select a setting from the sidebar to manage your preferences.</p>
      </div>
    </div>
  );
}