import React from "react";
import SettingsLayout from "./SettingsLayout";
import NotificationSettings from "../components/NotificationSettings";
import { auth } from "../firebaseConfig";

export default function NotificationSettingsPage() {
  return (
    <SettingsLayout title="Notifications">
      <NotificationSettings userId={auth.currentUser?.uid} />
    </SettingsLayout>
  );
}