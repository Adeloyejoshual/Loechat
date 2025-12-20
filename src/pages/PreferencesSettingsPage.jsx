import React from "react";
import SettingsLayout from "./SettingsLayout";
import ApplicationPreferencesSettings from "../components/ApplicationPreferencesSettings";

export default function PreferencesSettingsPage() {
  return (
    <SettingsLayout title="Application Preferences">
      <ApplicationPreferencesSettings />
    </SettingsLayout>
  );
}