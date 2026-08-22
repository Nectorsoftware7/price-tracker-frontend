import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";
import { Pager, usePagination } from "../components/Pager.jsx";

const SITE_OPTIONS = ["shopify", "woocommerce", "flipkart", "meesho", "jiomart", "tira", "nykaa", "snapdeal", "purplle", "myntra"];

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
  const chartRef = useRef(null);

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
  // Fifteen to a page, matching the stock-change log — both are scan-and-pick lists
  // rather than something read end to end.
  //
  // Declared above the early returns below: a hook skipped on the loading render and run
  // on the next one changes the hook order between renders, which React refuses outright.
  const variationPage = usePagination(priceVariations, {
    pageSize: 15,
    resetKey: `${variationRange}|${stockFilter}|${siteFilter}`,
  });

  if (loading) return <Loader />;
  if (products.length === 0) return <p style={{ color: "#487474" }}>No products tracked yet — add one on the Products page first.</p>;

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

  // The page itself doesn't scroll (.main is the scrolling container), so scrollIntoView
  // is used rather than window.scrollTo — it finds whichever ancestor actually scrolls.
  // Instant, since a smooth scroll only animates while the tab is being composited,
  // which isn't guaranteed the moment a click handler runs.
  function scrollToChart() {
    chartRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  // Jumping to a product's graph straight from the variations table. The product
  // dropdown at the top is filtered, so a product those filters exclude would leave the
  // dropdown and the chart showing different things — widen the filters in that case
  // rather than letting the two desync.
  function showGraphFor(product) {
    if (!matchesFilters(product, stockFilter, siteFilter)) {
      setStockFilter("all");
      setSiteFilter("all");
    }
    setProductId(product._id);
    scrollToChart();
  }

  return (
    <div>
      <h2>Price Analytics</h2>
      <p style={{ color: "#487474", marginTop: -8 }}>Pick any tracked product to see its price history and stock timeline.</p>

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
          <p style={{ color: "#487474" }}>No products match this stock status.</p>
        ) : (
        <select
          value={productId ?? ""}
          // Picking a product here means "show me this one's graph", but the chart now
          // sits below the variations table — so jump to it rather than leaving the
          // change happening off-screen.
          onChange={(e) => {
            setProductId(Number(e.target.value));
            scrollToChart();
          }}
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

      {/* The variations list comes first — it's the "which product should I look at?"
          view — and its View graph buttons scroll down to the chart below. */}
      <div className="card">
        <div className="form-row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <h3 ref={variationPage.topRef} style={{ margin: 0 }}>Price variations</h3>
          <div className="btn-group">
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
          <p style={{ color: "#487474", marginTop: 12 }}>
            No price has moved in the last {VARIATION_RANGES.find((r) => r.key === variationRange).label}.
          </p>
        ) : (
          <div className="table-scroll">
            <table style={{ marginTop: 12 }}>
              <colgroup>
                <col style={{ width: 220 }} />
                <col style={{ width: 130 }} />
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
                  <th>Graph analysis</th>
                  <th>Site</th>
                  <th>Current</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Avg</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {variationPage.visible.map(({ product: p, stats }) => (
                  <tr key={p._id}>
                    <td className="product-name">
                      <a href={p.url.replace(/\.(js|json)$/, "")} target="_blank" rel="noopener noreferrer" title={p.name}>
                        {p.name}
                      </a>
                    </td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => showGraphFor(p)}
                        title={`Show the price graph for ${p.name}`}
                      >
                        📈 View graph
                      </button>
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
        {variationPage.pageCount > 1 && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
            Showing {variationPage.from}–{variationPage.to} of {variationPage.total}
          </p>
        )}
        <Pager page={variationPage.page} pageCount={variationPage.pageCount} onChange={variationPage.goToPage} />
      </div>

      {history?.stats24h && (
        <div className="stat-row">
          <div className="stat"><div className="label">24h min</div><div className="value">₹{history.stats24h.min}</div></div>
          <div className="stat"><div className="label">24h max</div><div className="value">₹{history.stats24h.max}</div></div>
          <div className="stat"><div className="label">24h avg</div><div className="value">₹{history.stats24h.avg}</div></div>
          <div className="stat"><div className="label">samples</div><div className="value">{history.stats24h.samples}</div></div>
        </div>
      )}

      <div className="card" ref={chartRef}>
        {/* btn-group, not form-row: form-row turns into a column on a phone and stretches
            its buttons to full width, which stacked these three on top of each other
            while the range buttons above them stayed side by side. */}
        <div className="btn-group" style={{ marginBottom: 10 }}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#cfe6e4" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#487474" }} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: "#487474" }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #cfe6e4" }} />
              <Line type="monotone" dataKey="price" stroke="#007979" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
