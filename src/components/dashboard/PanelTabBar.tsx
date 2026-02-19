"use client";

import type { PanelTab } from "@/lib/types";

interface PanelTabBarProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
}

const TABS: { key: PanelTab; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "terminal", label: "Terminal" },
  { key: "tasks", label: "Tasks" },
];

export function PanelTabBar({ activeTab, onTabChange }: PanelTabBarProps) {
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
