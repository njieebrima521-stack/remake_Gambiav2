# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Backend (Lovable Cloud)

- Data, sign-in, file storage and the AI waste scanner run on Lovable Cloud; no extra setup is needed.
- Browser config is injected automatically (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Server-only values (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY`) are provided by the platform and never shipped to the browser.
- The first admin is the email listed in `admin_bootstrap_emails`; that account gets every workspace. Collector, hub, processor and admin sign-ups wait for admin approval.
- Not connected yet (clearly labelled in the app): live camera QR scanning, live route map, partner voucher fulfilment, collector payouts.
