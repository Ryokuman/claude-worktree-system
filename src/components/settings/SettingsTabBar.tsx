"use client";

export type SettingsTab = "env-template" | "terminal-init" | "claude-code" | "prompt" | "git" | "mcp" | "auto-feedback" | "pr" | "jira";

interface SettingsTabBarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "env-template", label: "Env Template" },
  { key: "terminal-init", label: "Terminal Init" },
  { key: "claude-code", label: "Claude Code" },
  { key: "prompt", label: "Prompt" },
  { key: "git", label: "Git" },
  { key: "mcp", label: "MCP" },
  { key: "auto-feedback", label: "Auto Feedback" },
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
