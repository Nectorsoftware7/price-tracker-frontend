import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import Loader from "../components/Loader.jsx";

// Reuses the exact colors StockBadge already uses for these same statuses (index.css
// .badge.*) — status color is reserved meaning, so the pie needs to agree with every
// badge on every other page rather than invent its own scheme.
const STATUS_COLORS = {
  in_stock: "#1c7a3c",
  low_stock: "#a15c00",
  out_of_stock: "#a71d1d",
  unknown: "#9c5b7c",
};
const STATUS_LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  unknown: "Unknown",
};

// Brand accent (--blue-500) for the two bar charts — a single-series bar doesn't carry
// "identity" the way a multi-series chart does, so one consistent hue is correct rather
// than a hue-per-bar; the axis labels already say which site is which.
const BAR_COLOR = "#f62477";
const PROBLEM_BAR_COLOR = STATUS_COLORS.out_of_stock;

// Bar charts pass `label` (the axis category); Pie has no axis, so its own slice name
// (payload[0].name) is the fallback heading instead.
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  const heading = label ?? payload[0].name;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{heading}</div>
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name}>{formatter ? formatter(p.value) : p.value}</div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { data: products = [], isLoading: loading } = useQuery({ queryKey: ["products"], queryFn: api.getProducts });

  const siteCounts = useMemo(() => {
    const counts = {};
    for (const p of products) counts[p.site] = (counts[p.site] || 0) + 1;
    return Object.entries(counts)
      .map(([site, count]) => ({ site, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const outOfStockBySite = useMemo(() => {
    const counts = {};
    for (const p of products) {
      if (p.lastStock === "out_of_stock") counts[p.site] = (counts[p.site] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([site, count]) => ({ site, count }))
      .sort((a, b) => b.count - a.count);
  }, [products]);

  const statusDistribution = useMemo(() => {
    const counts = { in_stock: 0, low_stock: 0, out_of_stock: 0, unknown: 0 };
    for (const p of products) counts[p.lastStock || "unknown"] = (counts[p.lastStock || "unknown"] || 0) + 1;
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count, name: STATUS_LABELS[status] }));
  }, [products]);

  if (loading) return <Loader />;

  const totalProducts = products.length;

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: "#4c6b8a", marginTop: -8 }}>A quick visual overview across every tracked product.</p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Products per site</h3>
        {siteCounts.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>No products tracked yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={siteCounts} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="site" tick={{ fontSize: 12, fill: "var(--text)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4c6b8a" }} />
              <Tooltip content={<CustomTooltip formatter={(v) => `${v} product${v === 1 ? "" : "s"}`} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Out-of-stock count per site</h3>
        <p style={{ color: "#4c6b8a", marginTop: -8, fontSize: 13 }}>Which site is causing the most out-of-stock listings right now.</p>
        {outOfStockBySite.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>Nothing out of stock — every tracked product is available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={outOfStockBySite} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="site" tick={{ fontSize: 12, fill: "var(--text)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#4c6b8a" }} />
              <Tooltip content={<CustomTooltip formatter={(v) => `${v} out of stock`} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="count" fill={PROBLEM_BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Overall stock-status distribution</h3>
        <p style={{ color: "#4c6b8a", marginTop: -8, fontSize: 13 }}>{totalProducts} products tracked in total.</p>
        {statusDistribution.length === 0 ? (
          <p style={{ color: "#4c6b8a" }}>No products tracked yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={statusDistribution}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {statusDistribution.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip formatter={(v) => `${v} products`} />} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
