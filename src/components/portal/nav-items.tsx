import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Database,
  HelpCircle,
  Home,
  Bell,
  Plug,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Home, exact: true },
  { label: "Workflows", to: "/dashboard/workflows", icon: Zap },
  { label: "Activity", to: "/dashboard/activity", icon: Activity },
  { label: "Saved data", to: "/dashboard/data", icon: Database },
  { label: "Integrations", to: "/dashboard/integrations", icon: Plug },
  { label: "Notifications", to: "/dashboard/notifications", icon: Bell },
  { label: "Settings", to: "/dashboard/settings", icon: Settings },
  { label: "Help", to: "/dashboard/help", icon: HelpCircle },
];

export function useIsActive() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (item: NavItem) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
}

export function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const active = isActive(item);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className="flex h-11 items-center gap-3 border-l-2 px-4 text-sm transition-colors"
      style={{
        borderLeftColor: active ? "var(--accent-green)" : "transparent",
        backgroundColor: active ? "var(--accent-green-subtle)" : "transparent",
        color: active ? "var(--accent-green)" : "var(--text-secondary)",
      }}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  );
}
