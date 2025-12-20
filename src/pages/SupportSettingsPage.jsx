import React from "react";
import SettingsLayout from "./SettingsLayout";
import SupportAndAboutSettings from "../components/SupportAndAboutSettings";

export default function SupportSettingsPage() {
  return (
    <SettingsLayout title="Support & About">
      <SupportAndAboutSettings />
    </SettingsLayout>
  );
}