import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";

const SITE_OPTIONS = ["shopify", "woocommerce", "flipkart", "meesho", "jiomart", "tira", "nykaa", "snapdeal", "purplle"];

const VARIATION_RANGES = [
  { key: "24h", label: "24 hours", hours: 24 },
  { key: "7d", label: "7 days", hours: 24 * 7 },
  { key: "15d", label: "15 days", hours: 24 * 15 },
];

export default function PriceAnalytics() {
  const [productId, setProductId] = useState(null);
  const [days, setDays] = useState(7);
  const [stockFilter, setStockFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [variationRange, setVariationRange] = useState("24h");

  const { data: products = [], isLoading: loading } = useQuery({ queryKey: ["products"], queryFn: api.getProducts });

  // Recomputed only when the selected range changes (not on every render) so the query
  // key stays stable and doesn't refetch just because some unrelated state changed.
  const { from: variationFrom, to: variationTo } = useMemo(() => {
    const range = VARIATION_RANGES.find((r) => r.key === variationRange);
    const to = new Date();
    const from = new Date(to.getTime() - range.hours * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationRange]);

  const { data: variationStats = {} } = useQuery({
    queryKey: ["stats", "analytics-variation", variationRange],
    queryFn: () => api.getAllStats(variationFrom, variationTo),
  });

  // Only products whose price actually moved in the window (min !== max) — a flat
  // price isn't a "variation" — sorted by how much it moved, biggest mover first.
  const priceVariations = useMemo(
    () =>
      products
        .map((p) => ({ product: p, stats: variationStats[p._id] }))
        .filter(({ stats }) => stats && stats.min !== stats.max)
        .sort((a, b) => b.stats.max - b.stats.min - (a.stats.max - a.stats.min)),
    [products, variationStats]
  );

  useEffect(() => {
    if (!productId && products.length > 0) setProductId(products[0]._id);
  }, [products, productId]);

  const { data: history = null } = useQuery({
    queryKey: ["history", productId, days],
    queryFn: () => api.getHistory(productId, days),
    enabled: Boolean(productId),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["stockEvents", productId],
    queryFn: () => api.getStockEvents(productId),
    enabled: Boolean(productId),
  });

  if (loading) return <Loader />;
  if (products.length === 0) return <p style={{ color: "#4c6b8a" }}>No products tracked yet — add one on the Products page first.</p>;

  function matchesFilters(p, stock, site) {
    return (stock === "all" || (p.lastStock || "unknown") === stock) && (site === "all" || p.site === site);
  }

  const filteredProducts = products.filter((p) => matchesFilters(p, stockFilter, siteFilter));
  const selected = products.find((p) => p._id === productId);
  const chartData = (history?.points || []).map((p) => ({
    time: new Date(p.checkedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price: p.price,
  }));

  // If the currently-selected product doesn't match the new filter combo, fall back
  // to the first product that does (or clear the selection if none match) — otherwise
  // the dropdown would keep showing a product that's no longer in its own list.
  function applyFilterChange(nextStock, nextSite) {
    setStockFilter(nextStock);
    setSiteFilter(nextSite);
    if (!selected || !matchesFilters(selected, nextStock, nextSite)) {
      const next = products.find((p) => matchesFilters(p, nextStock, nextSite));
      setProductId(next ? next._id : null);
    }
  }

  return (
    <div>
      <h2>Price Analytics</h2>
      <p style={{ color: "#4c6b8a", marginTop: -8 }}>Pick any tracked product to see its price history and stock timeline.</p>

      <div className="card">
        <div className="form-row">
          <select value={stockFilter} onChange={(e) => applyFilterChange(e.target.value, siteFilter)}>
            <option value="all">All stock statuses</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="unknown">Unknown</option>
          </select>
          <select value={siteFilter} onChange={(e) => applyFilterChange(stockFilter, e.target.value)}>
            <option value="all">All sites</option>
            {SITE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {filteredProducts.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>No products match this stock status.</p>
        ) : (
        <select
          value={productId ?? ""}
          onChange={(e) => setProductId(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 480 }}
        >
          {filteredProducts.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.site})
            </option>
          ))}
        </select>
        )}
        {selected && (
          <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <span>Current: <strong>₹{selected.lastPrice ?? "—"}</strong></span>
            <StockBadge status={selected.lastStock} quantity={selected.lastStockQuantity} />
            <a href={selected.url.replace(/\.(js|json)$/, "")} target="_blank" rel="noopener noreferrer">
              Open product page ↗
            </a>
          </div>
        )}
      </div>

      <div className="card">
        <div className="form-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Price variations</h3>
          <div style={{ display: "flex", gap: 8 }}>
            {VARIATION_RANGES.map((r) => (
              <button
                key={r.key}
                className={`btn ${variationRange === r.key ? "" : "secondary"}`}
                onClick={() => setVariationRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {priceVariations.length === 0 ? (
          <p style={{ color: "#4c6b8a", marginTop: 12 }}>
            No price has moved in the last {VARIATION_RANGES.find((r) => r.key === variationRange).label}.
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
                {priceVariations.map(({ product: p, stats }) => (
                  <tr key={p._id}>
                    <td>
                      <a href={p.url.replace(/\.(js|json)$/, "")} target="_blank" rel="noopener noreferrer" title={p.name}>
                        {p.name}
                      </a>
                    </td>
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

      {history?.stats24h && (
        <div className="stat-row">
          <div className="stat"><div className="label">24h min</div><div className="value">₹{history.stats24h.min}</div></div>
          <div className="stat"><div className="label">24h max</div><div className="value">₹{history.stats24h.max}</div></div>
          <div className="stat"><div className="label">24h avg</div><div className="value">₹{history.stats24h.avg}</div></div>
          <div className="stat"><div className="label">samples</div><div className="value">{history.stats24h.samples}</div></div>
        </div>
      )}

      <div className="card">
        <div className="form-row">
          {[1, 7, 30].map((d) => (
            <button key={d} className={`btn ${days === d ? "" : "secondary"}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        {chartData.length === 0 ? (
          <p>No price points recorded yet in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfe0fb" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#4c6b8a" }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: "#4c6b8a" }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #bfe0fb" }} />
              <Line type="monotone" dataKey="price" stroke="#2196f3" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Stock history</h3>
        {events.length === 0 ? (
          <p>No stock events yet.</p>
        ) : (
          <div className="table-scroll">
          <table>
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead><tr><th>Status</th><th>Detail</th><th>When</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e._id}>
                  <td><StockBadge status={e.status} /></td>
                  <td>{e.raw || "—"}</td>
                  <td>{new Date(e.checkedAt).toLocaleString()}</td>
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
