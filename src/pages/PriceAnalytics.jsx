import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";

export default function PriceAnalytics() {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState(null);
  const [history, setHistory] = useState(null);
  const [events, setEvents] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProducts().then((list) => {
      setProducts(list);
      if (list.length > 0) setProductId(list[0]._id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!productId) return;
    Promise.all([api.getHistory(productId, days), api.getStockEvents(productId)]).then(([h, e]) => {
      setHistory(h);
      setEvents(e);
    });
  }, [productId, days]);

  if (loading) return <p>Loading...</p>;
  if (products.length === 0) return <p style={{ color: "#4c6b8a" }}>No products tracked yet — add one on the Products page first.</p>;

  const selected = products.find((p) => p._id === productId);
  const chartData = (history?.points || []).map((p) => ({
    time: new Date(p.checkedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price: p.price,
  }));

  return (
    <div>
      <h2>Price Analytics</h2>
      <p style={{ color: "#4c6b8a", marginTop: -8 }}>Pick any tracked product to see its price history and stock timeline.</p>

      <div className="card">
        <select
          value={productId}
          onChange={(e) => setProductId(Number(e.target.value))}
          style={{ width: "100%", maxWidth: 480 }}
        >
          {products.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name} ({p.site})
            </option>
          ))}
        </select>
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
          <table>
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
        )}
      </div>
    </div>
  );
}
