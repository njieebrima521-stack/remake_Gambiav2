import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, ChevronDown, Landmark, Lock, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRemake } from "@/lib/remake/store";
import type { AppRole } from "@/lib/remake/types";
import { cn } from "@/lib/utils";
import { INSTITUTION_KEYS, PRIMARY_ROLES, personaFor, roleByKey, roleFor } from "./nav";

const itemCls = "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm";

/** Account dropdown: switch between the workspaces this account actually holds, open profile, sign out. */
export function AccountMenu({ name }: { name: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { state, signOut } = useRemake();
  const persona = personaFor(path, name, state.me?.orgs);
  const active = roleFor(path).key;
  const navigate = useNavigate();
  const roles = new Set<string>(state.me?.roles ?? []);
  const inInstitution = (INSTITUTION_KEYS as readonly string[]).includes(active);
  const hasInstitution = INSTITUTION_KEYS.some((k) => roles.has(k));

  const go = (key: string) => navigate({ to: roleByKey(key).home });
  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const Option = ({ k }: { k: string }) => {
    const r = roleByKey(k);
    const on = active === k;
    const allowed = roles.has(k);
    const pending = state.me?.pendingRoles.includes(k as AppRole);
    return (
      <DropdownMenuItem
        disabled={!allowed}
        onSelect={() => allowed && go(k)}
        className={cn(itemCls, on && "bg-mint font-semibold text-mint-foreground focus:bg-mint")}
      >
        <r.icon className="size-4" />
        <span className="flex-1">{r.label}</span>
        {on ? (
          <Check className="size-4 text-primary" />
        ) : (
          !allowed &&
          (pending ? <span className="text-[10px]">Pending</span> : <Lock className="size-3.5" />)
        )}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-3 rounded-full border bg-card py-1 pl-1 pr-3 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/30"
          title={persona.org}
          aria-label="Account menu"
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {persona.initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-semibold">{name}</span>
            <span className="block text-[11px] text-muted-foreground">{persona.role}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-64 rounded-xl p-1.5"
      >
        <DropdownMenuLabel className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Account
        </DropdownMenuLabel>
        <DropdownMenuItem asChild className={itemCls}>
          <Link to="/resident/profile">
            <UserRound className="size-4" /> User profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        {PRIMARY_ROLES.map((k) => (
          <Option key={k} k={k} />
        ))}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className={cn(
              itemCls,
              inInstitution && "bg-mint font-semibold text-mint-foreground",
              !hasInstitution && "text-muted-foreground",
            )}
          >
            <Landmark className="size-4" />
            <span className="flex-1">Institution</span>
            {inInstitution && (
              <span className="text-[11px] font-normal">{roleByKey(active).label}</span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent collisionPadding={12} className="w-52 rounded-xl p-1.5">
            {INSTITUTION_KEYS.map((k) => (
              <Option key={k} k={k} />
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={doSignOut} className={itemCls}>
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
