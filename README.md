# Price Tracker — Frontend

React (Vite) admin dashboard for the price/stock tracker: add/edit/delete tracked products, view
live price and stock, trigger manual or bulk checks, view price history, and manage AI-generated
replies to product reviews and Contact Form 7 submissions.

The backend API lives in a separate repo — see
[price-tracker-backend](https://github.com/Nectorsoftware7/price-tracker-backend).

## Tech Stack

- **React 18 + Vite** — SPA, built to static files
- **React Router** — client-side routing
- **Recharts** — price history charts
- Built and served via **Nginx** in production (see `Dockerfile` / `nginx.conf`)

No client-side environment variables are used — the app calls `/api/*` as a relative path (see
`src/api.js`), and in production Nginx reverse-proxies that path to the backend.

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

- **Products** — add a product (name, site, URL), see live price/stock, "Check now" for an
  immediate check, "Check all products" for a bulk check, click a product for its price history.
- **AI Replies** — Shopify/WordPress product-review auto-reply log and manual trigger.
- **Contact Form** — Contact Form 7 submission log and AI-generated replies.

## Login

Dashboard access requires the `ADMIN_USERNAME`/`ADMIN_PASSWORD` credentials configured on the
**backend** (this app has no credentials/env of its own — auth is entirely delegated to the API via
JWT).
