"use client";

import { useState } from "react";
import { SettingsTabBar, type SettingsTab } from "./SettingsTabBar";
import { TerminalInitTab } from "./TerminalInitTab";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("terminal-init");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <span className="text-sm font-semibold text-gray-200">Settings</span>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          &times;
        </button>
      </div>

      {/* Tab Bar */}
      <SettingsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Env Template Tab */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: activeTab === "env-template" ? "block" : "none" }}
        >
          <div className="p-6 text-sm text-gray-500">
            Env Template settings (coming soon)
          </div>
        </div>

        {/* Terminal Init Tab */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: activeTab === "terminal-init" ? "block" : "none" }}
        >
          <TerminalInitTab />
        </div>

        {/* PR Tab */}
        <div
          className="absolute inset-0 overflow-auto"
          style={{ display: activeTab === "pr" ? "block" : "none" }}
        >
          <div className="p-6 text-sm text-gray-500">
            PR settings (coming soon)
          </div>
        </div>
      </div>
    </div>
  );
}
