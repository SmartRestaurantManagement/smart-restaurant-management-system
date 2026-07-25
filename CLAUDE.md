# kaizen

Restaurant management app. Next.js App Router at the repo root (`app/`, `components/`, `lib/`, `types/` — no `src/`).

## Stack

- **Next.js 14.2.35**, App Router. Do not upgrade to 15/16 without discussion.
- **Tailwind v4**, CSS-first config. There is no `tailwind.config.ts` — theme tokens (colors, radius) live in `app/globals.css` via `@theme inline`. Don't recreate a JS config file.
- **shadcn/ui** (`components/ui/`) — generated components assume Tailwind v4 syntax (`has-data-[...]`, `color-mix()`, etc).
- **Supabase** — project ref `qyxgrzolvrfbmaseycek`, linked via `supabase link`. Schema lives in `supabase/migrations/`.

## Types

`types/database.ts` is generated output — regenerate it after any migration change, never hand-edit:

```
supabase gen types typescript --linked > types/database.ts
```

## Route groups

`app/` is split into three route groups, each owned by a different person per the project plan:

- `(customer)/` — customer-facing ordering/reservation flows
- `(staff)/` — staff/kitchen operations
- `(auth)/` — sign-in/sign-up

Keep changes within your group's boundary; shared UI goes in `components/`.
