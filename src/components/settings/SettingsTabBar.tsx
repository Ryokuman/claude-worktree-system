"use client";

export type SettingsTab = "env-template" | "terminal-init" | "pr" | "jira";

interface SettingsTabBarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "env-template", label: "Env Template" },
  { key: "terminal-init", label: "Terminal Init" },
  { key: "pr", label: "PR" },
  { key: "jira", label: "Jira" },
];

export function SettingsTabBar({ activeTab, onTabChange }: SettingsTabBarProps) {
  return (
    <div className="flex border-b border-white/8">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`chrome-tab ${activeTab === tab.key ? "active" : ""}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
