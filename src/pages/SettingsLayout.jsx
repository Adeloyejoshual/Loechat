import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function SettingsLayout({ title, children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ArrowLeftIcon
          className="w-6 h-6 cursor-pointer"
          onClick={() => navigate("/settings")}
        />
        <h1 className="text-xl font-bold">{title}</h1>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow">
        {children}
      </div>
    </div>
  );
}