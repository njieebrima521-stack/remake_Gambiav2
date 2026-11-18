import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRemake } from "@/lib/remake/store";
import { fmtShortDate } from "@/lib/remake/format";
import { errorMessage } from "@/lib/remake/logic";
import { cn } from "@/lib/utils";

/** Header bell for non-resident workspaces: recent notifications in a dropdown. */
export function NotificationsMenu({ unread }: { unread: number }) {
  const { state, markNotificationsRead } = useRemake();
  const list = state.notifications.slice(0, 8);
  const markAll = () => markNotificationsRead(null).catch((e) => toast.error(errorMessage(e)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative grid size-10 place-items-center rounded-full border bg-card hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 rounded-xl p-1.5"
      >
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <DropdownMenuLabel className="p-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Notifications
          </DropdownMenuLabel>
          <button
            className="text-xs font-semibold text-primary disabled:opacity-40"
            disabled={!unread}
            onClick={markAll}
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator />
        {list.length === 0 && (
          <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        )}
        {list.map((n) => (
          <DropdownMenuItem
            key={n.id}
            asChild
            className={cn(
              "flex cursor-pointer flex-col items-start gap-0.5 rounded-lg px-2.5 py-2",
              !n.read && "bg-mint",
            )}
          >
            <Link
              to={n.link ?? "/"}
              onClick={() => !n.read && markNotificationsRead([n.id]).catch(() => undefined)}
            >
              <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                {n.title}
                <span className="text-[11px] font-normal text-muted-foreground">
                  {fmtShortDate(n.date)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{n.body}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
