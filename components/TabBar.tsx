"use client";

export type Tab = "today" | "trends" | "goals";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "🍽️" },
  { id: "trends", label: "Trends", icon: "📈" },
  { id: "goals", label: "Goals", icon: "🎯" },
];

export default function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${active === t.id ? "active" : ""}`}
            onClick={() => onChange(t.id)}
            aria-label={t.label}
          >
            <span className="ico">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
