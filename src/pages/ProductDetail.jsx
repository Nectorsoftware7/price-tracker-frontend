import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";

export default function ProductDetail() {
  const { id } = useParams();
  const [history, setHistory] = useState(null);
  const [events, setEvents] = useState([]);
  const [days, setDays] = useState(7);

  async function load() {
    const [h, e] = await Promise.all([api.getHistory(id, days), api.getStockEvents(id)]);
    setHistory(h);
    setEvents(e);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, days]);

  if (!history) return <Loader />;

  const chartData = history.points.map((p) => ({
    time: new Date(p.checkedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    price: p.price,
  }));

  return (
    <div>
      <p><Link to="/">← Back to products</Link></p>
      <h2>Price history</h2>

      {history.stats24h && (
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
          <ResponsiveContainer width="100%" height={300}>
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
