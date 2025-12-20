// src/components/SettingsPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockClosedIcon,
  BellIcon,
  Cog6ToothIcon,
  CloudArrowDownIcon,
  QuestionMarkCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

import PrivacyAndSecuritySettings from "./PrivacyAndSecuritySettings";
import NotificationSettings from "./NotificationSettings";
import ApplicationPreferencesSettings from "./ApplicationPreferencesSettings";
import DataAndStorageSettings from "./DataAndStorageSettings";
import SupportAndAboutSettings from "./SupportAndAboutSettings";
import AccountActionsSettings from "./AccountActionsSettings";
import { auth } from "../firebaseConfig";

const sections = [
  { id: "privacy", label: "Privacy & Security", icon: <LockClosedIcon className="w-5 h-5 mr-2" /> },
  { id: "notifications", label: "Notifications", icon: <BellIcon className="w-5 h-5 mr-2" /> },
  { id: "preferences", label: "Application Preferences", icon: <Cog6ToothIcon className="w-5 h-5 mr-2" /> },
  { id: "data", label: "Data & Storage", icon: <CloudArrowDownIcon className="w-5 h-5 mr-2" /> },
  { id: "support", label: "Support & About", icon: <QuestionMarkCircleIcon className="w-5 h-5 mr-2" /> },
  { id: "account", label: "Account Actions", icon: <ExclamationTriangleIcon className="w-5 h-5 mr-2" /> },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;
  const [activeSection, setActiveSection] = useState("privacy");

  const renderSection = () => {
    switch (activeSection) {
      case "privacy":
        return <PrivacyAndSecuritySettings userId={userId} />;
      case "notifications":
        return <NotificationSettings userId={userId} />;
      case "preferences":
        return <ApplicationPreferencesSettings />;
      case "data":
        return <DataAndStorageSettings userId={userId} />;
      case "support":
        return <SupportAndAboutSettings />;
      case "account":
        return <AccountActionsSettings userId={userId} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 p-6 sm:p-10 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-1/4 mb-6 lg:mb-0">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:underline"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Settings</h1>
        <ul className="space-y-3">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={`flex items-center w-full text-left px-4 py-2 rounded-lg transition ${
                  activeSection === section.id
                    ? "bg-blue-500 text-white"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700"
                }`}
                onClick={() => setActiveSection(section.id)}
              >
                {section.icon}
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-white dark:bg-zinc-800 rounded-2xl shadow-md p-6 transition-all duration-300">
        {renderSection()}
      </main>
    </div>
  );
}