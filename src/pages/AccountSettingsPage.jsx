import React from "react";
import SettingsLayout from "./SettingsLayout";
import AccountActionsSettings from "../components/AccountActionsSettings";
import { auth } from "../firebaseConfig";

export default function AccountSettingsPage() {
  return (
    <SettingsLayout title="Account Actions">
      <AccountActionsSettings userId={auth.currentUser?.uid} />
    </SettingsLayout>
  );
}