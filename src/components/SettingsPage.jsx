import React from "react";
import { Outlet } from "react-router-dom";
import SettingsSidebar from "./SettingsSidebar";

export default function SettingsPage() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#f9fafb",
      }}
    >
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Content area */}
      <div style={{ flex: 1, padding: 24 }}>
        <h1>Settings</h1>
        <p>Select an option from the sidebar.</p>
        <Outlet />
      </div>
    </div>
  );
}