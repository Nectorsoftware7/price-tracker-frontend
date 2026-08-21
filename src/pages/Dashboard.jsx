import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LabelList,
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
  unknown: "#487474",
};
const STATUS_LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  unknown: "Unknown",
};

// Brand accent for the site bar charts — a single-series bar doesn't carry "identity"
// the way a multi-series chart does, so one consistent hue is correct rather than a
// hue-per-bar; the axis labels already say which site is which.
const BAR_COLOR = "#24b1b1";
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

// The two site charts are the same chart with different data and a different hue, so
// they share one component rather than two near-copies. They had already drifted apart
// — only one carried a caption, and their axis styling differed — which reads as an
// inconsistency rather than a distinction now that they sit side by side.
//
// The hue is the one thing that legitimately differs: out-of-stock is a *status*, and
// its red is the same red the badge uses on every other page, so recolouring it to the
// brand teal would throw away meaning the reader already knows how to read.
function SiteBarChart({ title, subtitle, data, color, emptyText, formatter }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "var(--text-muted)", marginTop: -8, fontSize: 13 }}>{subtitle}</p>
      {data.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>{emptyText}</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {/* Top margin leaves room for the value labels, which sit above each bar. */}
          <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            {/* interval={0} keeps every site named — at half width recharts would
                otherwise start dropping labels to avoid overlap. */}
            <XAxis
              dataKey="site"
              interval={0}
              tick={{ fontSize: 11, fill: "var(--text)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              allowDecimals={false}
              width={30}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip formatter={formatter} />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={44}>
              {/* Few enough bars that labelling every one stays quiet, and it saves a
                  hover just to read a count off the axis. */}
              <LabelList dataKey="count" position="top" fill="var(--text-muted)" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
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
      <p style={{ color: "var(--text-muted)", marginTop: -8 }}>A quick visual overview across every tracked product.</p>

      {/* Side by side: the second chart is a breakdown of a slice of the first, so
          reading them together is the point — stacked, that comparison needs a scroll. */}
      <div className="chart-grid">
        <SiteBarChart
          title="Products per site"
          subtitle="How many tracked listings each marketplace accounts for."
          data={siteCounts}
          color={BAR_COLOR}
          emptyText="No products tracked yet."
          formatter={(v) => `${v} product${v === 1 ? "" : "s"}`}
        />
        <SiteBarChart
          title="Out-of-stock count per site"
          subtitle="Which site is causing the most out-of-stock listings right now."
          data={outOfStockBySite}
          color={PROBLEM_BAR_COLOR}
          emptyText="Nothing out of stock — every tracked product is available."
          formatter={(v) => `${v} out of stock`}
        />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Overall stock-status distribution</h3>
        <p style={{ color: "var(--text-muted)", marginTop: -8, fontSize: 13 }}>{totalProducts} products tracked in total.</p>
        {statusDistribution.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No products tracked yet.</p>
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
