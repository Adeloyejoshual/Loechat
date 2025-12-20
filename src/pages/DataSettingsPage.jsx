import React from "react";
import SettingsLayout from "./SettingsLayout";
import DataAndStorageSettings from "../components/DataAndStorageSettings";
import { auth } from "../firebaseConfig";

export default function DataSettingsPage() {
  return (
    <SettingsLayout title="Data & Storage">
      <DataAndStorageSettings userId={auth.currentUser?.uid} />
    </SettingsLayout>
  );
}