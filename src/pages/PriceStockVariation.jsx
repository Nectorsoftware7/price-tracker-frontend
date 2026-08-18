import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";

const FLAGGED_STATUSES = ["out_of_stock", "low_stock"];
const NAME_MAX_LENGTH = 42;
const SITE_OPTIONS = ["shopify", "woocommerce", "flipkart", "meesho", "jiomart", "tira", "nykaa", "snapdeal", "purplle", "myntra"];

const ACTIVITY_RANGES = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "15d", label: "15 days", hours: 24 * 15 },
];

// Shopify URLs are stored as the .js/.json scraping endpoint, not the human-readable
// page — strip that suffix so links open the actual storefront product page.
function toDisplayUrl(url) {
  return url.replace(/\.(js|json)$/, "");
}

function shortenName(name) {
  return name.length > NAME_MAX_LENGTH ? `${name.slice(0, NAME_MAX_LENGTH - 1)}…` : name;
}

function ProductLink({ product }) {
  return (
    <a href={toDisplayUrl(product.url)} target="_blank" rel="noopener noreferrer" title={product.name}>
      {shortenName(product.name)}
    </a>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Dashboard equivalent of the "Price & Stock Changes" Google Sheet tab — a timestamped
// feed of every stock-status change across all products, not just a current snapshot
// (the Flagged table above only shows what's flagged *right now*, with no trace of
// when it happened or what changed before it).
function RecentStockChanges({ siteFilter, activityCutoff }) {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ["stockEvents", "recent"],
    queryFn: api.getAllStockEvents,
  });

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (siteFilter === "all" || e.productSite === siteFilter) &&
          (statusFilter === "all" || e.status === statusFilter) &&
          new Date(e.checkedAt).getTime() >= activityCutoff
      ),
    [events, siteFilter, statusFilter, activityCutoff]
  );

  return (
    <div className="card">
      <div className="form-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🕐 Recent stock changes</h3>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All stock statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
      {isLoading ? (
        <p style={{ color: "#4c6b8a" }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "#a71d1d" }}>{error.message}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#4c6b8a" }}>No stock changes recorded yet.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <colgroup>
              <col style={{ width: 150 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 200 }} />
            </colgroup>
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Site</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e._id}>
                  <td>{new Date(e.checkedAt).toLocaleString()}</td>
                  <td>
                    <a href={toDisplayUrl(e.productUrl)} target="_blank" rel="noopener noreferrer" title={e.productName}>
                      {shortenName(e.productName)}
                    </a>
                  </td>
                  <td>{e.productSite}</td>
                  <td><StockBadge status={e.status} quantity={e.quantity} /></td>
                  <td>{e.raw || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PriceStockVariation() {
  const [sortDir, setSortDir] = useState("desc"); // "desc" = high to low, "asc" = low to high
  const [fromDate, setFromDate] = useState(""); // empty = default "last 24h" mode
  const [toDate, setToDate] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [activityRange, setActivityRange] = useState("24h"); // Flagged + Recent stock changes

  const useCustomRange = Boolean(fromDate && toDate);

  // Recomputed only when the selected range changes, not on every render — Date.now()
  // moves every millisecond, and re-deriving it on unrelated re-renders would produce a
  // new cutoff value each time, defeating the point of a stable filter.
  const activityCutoff = useMemo(() => {
    const range = ACTIVITY_RANGES.find((r) => r.key === activityRange);
    return Date.now() - range.hours * 60 * 60 * 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityRange]);

  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["products"],
    queryFn: api.getProducts,
  });

  // A single bulk call for every product's stats in the window, instead of one
  // /history request per product — that used to mean 139 concurrent requests on the
  // full list, which could overwhelm the free-tier backend instance and made this
  // page look permanently stuck on "Loading..." (worse each time it was revisited,
  // since the previous batch's in-flight requests were never cancelled). Keyed on the
  // date range so switching ranges fetches fresh stats but flipping back to a range
  // already seen this session shows it instantly from cache.
  const { data: rangeStats = {}, error: statsError } = useQuery({
    queryKey: useCustomRange ? ["stats", fromDate, toDate] : ["stats", "last24h"],
    queryFn: () =>
      useCustomRange ? api.getAllStats(`${fromDate}T00:00:00`, `${toDate}T23:59:59`) : api.getAllStats(),
  });

  const loading = productsLoading;
  const error = productsError?.message || statsError?.message || null;

  function clearRange() {
    setFromDate("");
    setToDate("");
  }

  const bySite = (p) => siteFilter === "all" || p.site === siteFilter;

  const flagged = useMemo(
    () =>
      products.filter(
        (p) =>
          FLAGGED_STATUSES.includes(p.lastStock) &&
          bySite(p) &&
          p.lastCheckedAt &&
          new Date(p.lastCheckedAt).getTime() >= activityCutoff
      ),
    [products, siteFilter, activityCutoff]
  );

  // "Flagged" mixes out-of-stock with low-stock, but the usual question is just "how
  // many are actually out of stock right now" — so that count is stated above the table.
  const outOfStock = useMemo(() => flagged.filter((p) => p.lastStock === "out_of_stock"), [flagged]);

  // Only products with an actual price swing in the window (min != max) — a flat price isn't a "variation".
  const varied = useMemo(() => {
    const withVariation = products
      .filter(bySite)
      .map((p) => ({ product: p, stats: rangeStats[p._id] }))
      .filter(({ stats }) => stats && stats.min !== stats.max);
    return withVariation.sort((a, b) =>
      sortDir === "asc" ? a.product.lastPrice - b.product.lastPrice : b.product.lastPrice - a.product.lastPrice
    );
  }, [products, rangeStats, sortDir, siteFilter]);

  if (loading) return <Loader />;

  return (
    <div>
      <h2>Stock status</h2>
      {error && <div className="card" style={{ color: "#a71d1d" }}>{error}</div>}

      <div className="card">
        <div className="form-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
            <option value="all">All sites</option>
            {SITE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            {ACTIVITY_RANGES.map((r) => (
              <button
                key={r.key}
                className={`btn ${activityRange === r.key ? "" : "secondary"}`}
                onClick={() => setActivityRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>⚠️ Flagged (out of stock / low stock)</h3>

        <p style={{ color: "#4c6b8a", marginTop: 8 }}>
          <b style={{ color: "var(--text)" }}>{outOfStock.length}</b> out of stock
          {flagged.length - outOfStock.length > 0 && `, ${flagged.length - outOfStock.length} low stock`}
        </p>

        {flagged.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>
            Nothing flagged in the last {ACTIVITY_RANGES.find((r) => r.key === activityRange).label.toLowerCase()}.
          </p>
        ) : (
          <div className="table-scroll">
          <table>
            {/* Fixed, tight column widths instead of the browser's default table-layout,
                which stretches columns to fill the container evenly regardless of how
                little content Site/Stock actually need — that read as a huge, uneven gap
                between Product and Site especially on mobile. */}
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Product</th>
                <th>Site</th>
                <th>Stock</th>
                <th>Last checked</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((p) => (
                <tr key={p._id}>
                  <td><ProductLink product={p} /></td>
                  <td>{p.site}</td>
                  <td><StockBadge status={p.lastStock} quantity={p.lastStockQuantity} /></td>
                  <td>{p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <RecentStockChanges siteFilter={siteFilter} activityCutoff={activityCutoff} />

      <div className="card">
        <div className="form-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Price variation {useCustomRange ? `(${fromDate} → ${toDate})` : "(last 24h)"}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className={`btn ${sortDir === "desc" ? "" : "secondary"}`} onClick={() => setSortDir("desc")}>
              High → Low
            </button>
            <button className={`btn ${sortDir === "asc" ? "" : "secondary"}`} onClick={() => setSortDir("asc")}>
              Low → High
            </button>
          </div>
        </div>

        <div className="form-row" style={{ alignItems: "center", marginTop: 12 }}>
          <label style={{ fontSize: 13, color: "#4c6b8a" }}>
            From{" "}
            <input type="date" value={fromDate} max={toDate || todayStr()} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label style={{ fontSize: 13, color: "#4c6b8a" }}>
            To{" "}
            <input type="date" value={toDate} min={fromDate} max={todayStr()} onChange={(e) => setToDate(e.target.value)} />
          </label>
          {useCustomRange && (
            <button className="btn secondary" onClick={clearRange}>
              Reset to last 24h
            </button>
          )}
        </div>

        {varied.length === 0 ? (
          <p style={{ color: "#4c6b8a", marginTop: 12 }}>
            No price has moved {useCustomRange ? "in the selected date range" : "in the last 24 hours"}.
          </p>
        ) : (
          <div className="table-scroll">
          <table style={{ marginTop: 12 }}>
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Product</th>
                <th>Site</th>
                <th>Current</th>
                <th>Min</th>
                <th>Max</th>
                <th>Avg</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {varied.map(({ product: p, stats }) => (
                <tr key={p._id}>
                  <td><ProductLink product={p} /></td>
                  <td>{p.site}</td>
                  <td>₹{p.lastPrice}</td>
                  <td>₹{stats.min}</td>
                  <td>₹{stats.max}</td>
                  <td>₹{stats.avg}</td>
                  <td><StockBadge status={p.lastStock} quantity={p.lastStockQuantity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
