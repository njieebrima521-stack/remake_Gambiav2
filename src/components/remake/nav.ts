import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  Factory,
  Gift,
  History,
  Home,
  Info,
  LayoutDashboard,
  Layers,
  MapPin,
  ReceiptText,
  Repeat,
  Route as RouteIcon,
  ScanLine,
  Settings,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type AppPath =
  | "/resident"
  | "/resident/scan"
  | "/resident/guide"
  | "/resident/pickups"
  | "/resident/rewards"
  | "/resident/notifications"
  | "/resident/profile"
  | "/collector"
  | "/collector/today"
  | "/collector/receipts"
  | "/collector/earnings"
  | "/hub"
  | "/processor"
  | "/processor/history"
  | "/business"
  | "/business/pickups"
  | "/business/reports"
  | "/admin";

export interface NavItem {
  to: AppPath;
  search?: Record<string, string> | undefined;
  label: string;
  icon: LucideIcon;
}

export interface RoleNav {
  key: string;
  label: string;
  home: AppPath;
  icon: LucideIcon;
  items: NavItem[];
}

export const ROLE_NAV: RoleNav[] = [
  {
    key: "resident",
    label: "Resident",
    home: "/resident",
    icon: UserRound,
    items: [
      { to: "/resident", label: "Dashboard", icon: LayoutDashboard },
      { to: "/resident/scan", label: "Waste Scanner", icon: ScanLine },
      { to: "/resident/guide", label: "Recycling Guide", icon: BookOpen },
      { to: "/resident/pickups", label: "Pickups", icon: Truck },
      { to: "/resident/rewards", label: "Green Coins & Rewards", icon: Gift },
      { to: "/resident/notifications", label: "Notifications", icon: Bell },
      { to: "/resident/profile", label: "Profile", icon: UserRound },
    ],
  },
  {
    key: "collector",
    label: "Collector",
    home: "/collector",
    icon: RouteIcon,
    items: [
      { to: "/collector", label: "Dashboard", icon: LayoutDashboard },
      { to: "/collector/today", label: "Today's route", icon: MapPin },
      { to: "/collector/receipts", label: "Records & receipts", icon: ReceiptText },
      { to: "/collector/earnings", label: "Earnings", icon: Wallet },
    ],
  },
  {
    key: "hub",
    label: "Institution",
    home: "/hub",
    icon: Warehouse,
    items: [
      { to: "/hub", search: { section: "overview" }, label: "Overview", icon: LayoutDashboard },
      { to: "/hub", search: { section: "collectors" }, label: "Collectors", icon: Users },
      { to: "/hub", search: { section: "collections" }, label: "Collections", icon: Truck },
      { to: "/hub", search: { section: "materials" }, label: "Materials", icon: Layers },
      { to: "/hub", search: { section: "settings" }, label: "Settings", icon: Settings },
    ],
  },
  {
    key: "processor",
    label: "Processor",
    home: "/processor",
    icon: Factory,
    items: [
      { to: "/processor", label: "Incoming batches", icon: Factory },
      { to: "/processor/history", label: "Processing history", icon: History },
    ],
  },
  {
    key: "business",
    label: "Business",
    home: "/business",
    icon: Building2,
    items: [
      { to: "/business", label: "Dashboard", icon: LayoutDashboard },
      { to: "/business/pickups", label: "Recurring pickups", icon: Repeat },
      { to: "/business/reports", label: "Impact reports", icon: BarChart3 },
    ],
  },
  {
    key: "admin",
    label: "Institution",
    home: "/admin",
    icon: ShieldCheck,
    items: [
      { to: "/admin", search: { section: "overview" }, label: "Overview", icon: LayoutDashboard },
      { to: "/admin", search: { section: "users" }, label: "Users", icon: UserRound },
      { to: "/admin", search: { section: "collectors" }, label: "Collectors", icon: Users },
      { to: "/admin", search: { section: "collections" }, label: "Collections", icon: Truck },
      { to: "/admin", search: { section: "materials" }, label: "Materials", icon: Layers },
      { to: "/admin", search: { section: "partners" }, label: "Partners", icon: Building2 },
      { to: "/admin", search: { section: "rewards" }, label: "Rewards", icon: Award },
      { to: "/admin", search: { section: "payouts" }, label: "Payouts", icon: CreditCard },
      {
        to: "/admin",
        search: { section: "transactions" },
        label: "Transactions",
        icon: ReceiptText,
      },
      { to: "/admin", search: { section: "activity" }, label: "Activity", icon: Activity },
      { to: "/admin", search: { section: "settings" }, label: "Settings", icon: Settings },
    ],
  },
];

export interface MobileNav {
  items: NavItem[];
  /** Raised centre action (resident scan button from the original design). */
  center?: NavItem | undefined;
}

/** Mobile bottom navigation per workspace; max 4 items plus an optional centre action. */
export const MOBILE_NAV: Record<string, MobileNav> = {
  resident: {
    items: [
      { to: "/resident", label: "Home", icon: Home },
      { to: "/resident/guide", label: "Info", icon: Info },
      { to: "/resident/pickups", label: "History", icon: History },
      { to: "/resident/profile", label: "Profile", icon: UserRound },
    ],
    center: { to: "/resident/scan", label: "Scan waste", icon: ScanLine },
  },
  collector: {
    items: [
      { to: "/collector", label: "Home", icon: Home },
      { to: "/collector/today", label: "Route", icon: MapPin },
      { to: "/collector/receipts", label: "Records", icon: ReceiptText },
      { to: "/collector/earnings", label: "Earnings", icon: Wallet },
    ],
  },
  hub: {
    items: [
      { to: "/hub", search: { section: "overview" }, label: "Overview", icon: LayoutDashboard },
      { to: "/hub", search: { section: "collectors" }, label: "Collectors", icon: Users },
      { to: "/hub", search: { section: "collections" }, label: "Collections", icon: Truck },
      { to: "/hub", search: { section: "settings" }, label: "Settings", icon: Settings },
    ],
  },
  processor: {
    items: [
      { to: "/processor", label: "Incoming", icon: Factory },
      { to: "/processor/history", label: "History", icon: History },
    ],
  },
  business: {
    items: [
      { to: "/business", label: "Home", icon: Home },
      { to: "/business/pickups", label: "Pickups", icon: Repeat },
      { to: "/business/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  admin: {
    items: [
      { to: "/admin", search: { section: "overview" }, label: "Overview", icon: ShieldCheck },
      { to: "/admin", search: { section: "collectors" }, label: "Collectors", icon: Users },
      { to: "/admin", search: { section: "collections" }, label: "Collections", icon: Truck },
      { to: "/admin", search: { section: "settings" }, label: "Settings", icon: Settings },
    ],
  },
};

export const INSTITUTION_KEYS = ["hub", "processor", "admin"] as const;
/** Primary account types; institutional workspaces sit under "institution". */
export const PRIMARY_ROLES = ["resident", "business", "collector"] as const;

export function roleByKey(key: string): RoleNav {
  return ROLE_NAV.find((r) => r.key === key) ?? ROLE_NAV[0]!;
}

export function roleFor(path: string): RoleNav {
  return ROLE_NAV.find((r) => path.startsWith(`/${r.key}`)) ?? ROLE_NAV[0]!;
}

export interface Persona {
  role: string;
  name: string;
  org: string;
  initials: string;
}

const ROLE_TITLE: Record<string, string> = {
  resident: "Resident",
  business: "Business",
  collector: "Collector",
  hub: "Hub operator",
  processor: "Processor",
  admin: "Administrator",
};

/** Header identity for the signed-in user in the workspace being viewed. */
export function personaFor(
  path: string,
  name: string,
  orgs: { name: string; kind: string }[] = [],
): Persona {
  const key = roleFor(path).key;
  const orgOf = (kind: string) => orgs.find((o) => o.kind === kind)?.name;
  const org =
    key === "business"
      ? (orgOf("business") ?? "Business")
      : key === "hub"
        ? (orgOf("hub") ?? "Recycling hub")
        : key === "processor"
          ? (orgOf("processor") ?? "Processor")
          : key === "admin"
            ? "Remake Operations"
            : key === "collector"
              ? "Remake Collector"
              : "Remake member";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "RM";
  return { role: ROLE_TITLE[key] ?? "Member", name: name || "Remake user", org, initials };
}
