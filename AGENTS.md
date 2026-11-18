<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Remake project rules

- Data lives in Lovable Cloud; `src/lib/remake/store.tsx` loads RLS-scoped rows into the `RemakeState` shape the pages already use, and every write goes through SECURITY DEFINER Postgres functions (book_pickup, record_collection, create_batch, verify_batch, redeem_reward, admin_*) — never direct table writes — because balances, weights and roles must be validated server-side. `logic.ts` keeps pure preview helpers mirrored from the SQL rules, tested in `logic.test.ts`.
- Routes needing sign-in are `_authenticated.*` files under the `_authenticated/route.tsx` gate (ssr: false); its WorkspaceGuard hides workspaces the account has no role for, mirroring the server checks.
- Pages address pickups/batches by human ref (`PU-1001`, `BT-301`) in URLs and UI; the store maps refs to uuids for backend calls.
- Collector offline mode queues weigh/reject actions in localStorage with client request ids and replays them idempotently on sync.
- The waste scanner calls Lovable AI from `scan.functions.ts` (server); results are indicative and 'accepted' requires an active material plus an active processor partner.
- Each role has its own sidebar items in `src/components/remake/nav.ts` (sidebar shows only the active workspace); below md a role-specific `BottomNav` (MOBILE_NAV) replaces the sidebar, between md and lg the sidebar is an icon rail; switching lives in the header `AccountMenu`, and sign-up picks the starting workspace — institution groups hub, processor and admin.
- Form state seeded from the store must tolerate data arriving after first render (derive or sync in an effect).
- Payouts are a ledger, not a money transfer: `payouts` rows group unpaid collections (collector, GMD/kg rate locked at creation) or redeemed vouchers (partner, voucher value snapshotted at redemption) via `payout_id`, so nothing is paid twice; admins record the real transfer with method + reference through `admin_mark_payout_paid`, and cancelling releases the items.
- The collector route map geocodes stop addresses server-side through the Google Maps gateway (`route-map.functions.ts`, capped per call) and caches them in `pickup_locations`; the browser only renders Maps JS with the referrer-restricted browser key, so it renders only on lovable.app/lovableproject.com hosts.
- Camera QR scanning (`QrScanner.tsx`) uses the native BarcodeDetector when available and lazy-loads jsQR otherwise; the decoded text goes through the same `verify_pickup_code` check as typed codes.
