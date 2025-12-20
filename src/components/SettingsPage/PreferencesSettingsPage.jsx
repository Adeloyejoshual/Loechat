import React from "react";
import SettingsLayout from "./SettingsLayout";
import NotificationSettings from "../NotificationSettings";

export default function NotificationSettingsPage() {
  return (
    <SettingsLayout title="Notifications">
      <NotificationSettings />
    </SettingsLayout>
  );
}