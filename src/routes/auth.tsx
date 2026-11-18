import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeRedirect } from "@/lib/remake/auth";

/** Demo mode: there is no login screen — anyone signed out is sent to the details form. */
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string | undefined } => ({
    redirect: safeRedirect(s["redirect"]) ?? undefined,
  }),
  beforeLoad: () => {
    throw redirect({ to: "/join", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Enter Remake" },
      { name: "description", content: "Enter the Remake demo by filling in your details." },
      { property: "og:title", content: "Enter Remake" },
      { property: "og:description", content: "Try Remake — no password needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
