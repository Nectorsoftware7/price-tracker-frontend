import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";

const FLAGGED_STATUSES = ["out_of_stock", "low_stock"];
const NAME_MAX_LENGTH = 42;

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

export default function PriceStockVariation() {
  const [products, setProducts] = useState([]);
  const [rangeStats, setRangeStats] = useState({}); // productId -> {min, max, avg, samples}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortDir, setSortDir] = useState("desc"); // "desc" = high to low, "asc" = low to high
  const [fromDate, setFromDate] = useState(""); // empty = default "last 24h" mode
  const [toDate, setToDate] = useState("");

  const useCustomRange = Boolean(fromDate && toDate);

  // A single bulk call for every product's stats in the window, instead of one
  // /history request per product — that used to mean 139 concurrent requests on the
  // full list, which could overwhelm the free-tier backend instance and made this
  // page look permanently stuck on "Loading..." (worse each time it was revisited,
  // since the previous batch's in-flight requests were never cancelled).
  async function load() {
    try {
      const stats = useCustomRange
        ? await api.getAllStats(`${fromDate}T00:00:00`, `${toDate}T23:59:59`)
        : await api.getAllStats();
      setRangeStats(stats);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadAll() {
    setLoading(true);
    try {
      const list = await api.getProducts();
      setProducts(list);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (products.length > 0) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  function clearRange() {
    setFromDate("");
    setToDate("");
  }

  const flagged = useMemo(() => products.filter((p) => FLAGGED_STATUSES.includes(p.lastStock)), [products]);

  // Only products with an actual price swing in the window (min != max) — a flat price isn't a "variation".
  const varied = useMemo(() => {
    const withVariation = products
      .map((p) => ({ product: p, stats: rangeStats[p._id] }))
      .filter(({ stats }) => stats && stats.min !== stats.max);
    return withVariation.sort((a, b) =>
      sortDir === "asc" ? a.product.lastPrice - b.product.lastPrice : b.product.lastPrice - a.product.lastPrice
    );
  }, [products, rangeStats, sortDir]);

  if (loading) return <Loader />;

  return (
    <div>
      <h2>Price &amp; Stock variation</h2>
      {error && <div className="card" style={{ color: "#a71d1d" }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>⚠️ Flagged (out of stock / low stock)</h3>
        {flagged.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>Nothing flagged right now — everything tracked is in stock.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Site</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((p) => (
                <tr key={p._id}>
                  <td><ProductLink product={p} /></td>
                  <td>{p.site}</td>
                  <td>{p.lastPrice != null ? `₹${p.lastPrice}` : "—"}</td>
                  <td><StockBadge status={p.lastStock} quantity={p.lastStockQuantity} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
          <table style={{ marginTop: 12 }}>
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
        )}
      </div>
    </div>
  );
}
