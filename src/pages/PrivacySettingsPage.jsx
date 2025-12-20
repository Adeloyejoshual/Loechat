import React from "react";
import SettingsLayout from "./SettingsLayout";
import PrivacyAndSecuritySettings from "../components/PrivacyAndSecuritySettings";
import { auth } from "../firebaseConfig";

export default function PrivacySettingsPage() {
  return (
    <SettingsLayout title="Privacy & Security">
      <PrivacyAndSecuritySettings userId={auth.currentUser?.uid} />
    </SettingsLayout>
  );
}