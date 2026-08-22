# Price Tracker — Frontend

React (Vite) dashboard for the price and stock tracker: manage the tracked listings, read the
charts, and reply to customers.

The backend API lives in a separate repo — see
[price-tracker-backend](https://github.com/Nectorsoftware7/price-tracker-backend).

## Tech Stack

- **React 18 + Vite** — SPA, built to static files
- **React Router** — client-side routing
- **TanStack Query** — data fetching and cache
- **Recharts** — every chart on the dashboard and the analytics page
- **SheetJS (`xlsx`)** — reads the bulk-import file and writes the product export
- Built and served via **Nginx** in production (see `Dockerfile` / `nginx.conf`)

The app calls `/api/*` as a relative path (see `src/api.js`); in production the host rewrites that
to the backend, so there is no API URL to configure here.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | No | Enables the "Sign in with Google" button. Must match `GOOGLE_CLIENT_ID` on the backend, and this app's origin has to be listed as an authorised JavaScript origin in Google Cloud Console — otherwise Google refuses with "the given origin is not allowed for the given client ID". Username/password login works without it |

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. In dev, Vite proxies `/api` to `http://localhost:4000` (see
`vite.config.js`) — run the backend locally alongside this for the dashboard to have data.

## Production build

```bash
npm run build    # outputs to dist/
```

`Dockerfile` builds this and serves it via Nginx. **`nginx.conf` hardcodes the backend's public URL**
in its `/api/` reverse-proxy rule — there is no env var for this — so if the backend's deployed URL
ever changes, update `nginx.conf` and redeploy this service.

```nginx
location /api/ {
    proxy_pass https://<your-backend-url>/api/;
    proxy_set_header Host <your-backend-url>;
    ...
}
```

## Pages

- **Dashboard** — headline figures, then: products per marketplace, out-of-stock per marketplace,
  the stock-status split, out-of-stock over time, the biggest price moves, which listings change
  price and stock most often, and the same product's price on each marketplace it is listed on.
- **Products** — add, edit and delete listings; search, sort and page the table; set a target price
  from the row; bulk-import from Excel and export the current selection back out; "Check now" for a
  single listing or "Check all products".
- **Stock status** — what is flagged right now, and a log of every stock change, filterable by
  status and by date range.
- **Price Analytics** — price variation per listing over 24h / 7d / 15d, and a price history chart
  per product.
- **Contact Form** — customer submissions as chat threads, with the AI's draft reply and a box to
  send your own.
- **Users** — approve, deactivate and set roles.

## Roles

Three, all enforced by the API rather than only hidden here:

| Role | Shown as | Can |
|---|---|---|
| `admin` | E-commerce Executive | Everything except user management |
| `superadmin` | Superadmin | Everything |
| `viewer` | Viewer | Read only — every page and button is visible, and any write is refused with a notice. Meant for demos |

## Login

Credentials come from the **backend** (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, seeded there with
`npm run seed:admin`). This app holds no credentials of its own; auth is delegated to the API and
carried as a JWT.
