import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
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
// .badge.*) — status color is reserved meaning, so the donut needs to agree with every
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

// A price movement has polarity, not status, so it needs a diverging pair rather than
// the green/amber/red the badges own — reusing those would imply a listing is healthy
// or broken when all that happened is the number moved. This pair clears the validator
// on every check, with a worst-case CVD separation of 19.1 (protan).
const UP_COLOR = "#c41055";
const DOWN_COLOR = "#0b6fc4";

const WINDOW_DAYS = 14;

// Bar charts pass `label` (the axis category); Pie has no axis, so its own slice name
// (payload[0].name) is the fallback heading instead.
function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  const heading = label ?? payload[0].name;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{heading}</div>
      {payload.map((p) => (
        <div key={p.dataKey ?? p.name}>{formatter ? formatter(p.value, p.payload) : p.value}</div>
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

// The percentage beside each arc is text, so it wears a text colour. Left to recharts
// it inherits the slice's fill, which makes the number look like part of the encoding —
// the arc already carries the colour, and a green "87%" competes with it.
function renderSlicePercent({ cx, cy, midAngle, outerRadius, percent }) {
  const radians = Math.PI / 180;
  const distance = outerRadius + 18;
  const x = cx + distance * Math.cos(-midAngle * radians);
  const y = cy + distance * Math.sin(-midAngle * radians);
  return (
    <text
      x={x}
      y={y}
      fill="var(--text-muted)"
      fontSize={12}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// recharts sizes its axes in props, not CSS, so the movers chart cannot be made
// responsive with a media query alone. At 375px a 230px name column left roughly 75px
// of plot: the bars collapsed to slivers and their value labels landed on top of the
// names. This watches the same 860px breakpoint the layout already uses.
function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 860px)").matches : false
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 860px)");
    const update = (event) => setNarrow(event.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

// On a narrow screen there is no room outside the bar for its value — the longest bar
// ends flush against the name column and the two overlap. So the label moves inside the
// bar, in white (5.1:1 on the blue, 5.9:1 on the pink — both clear AA).
//
// A bar too short to hold its own text keeps the label outside instead, where it sits
// near the zero line rather than out by the names, so nothing collides either way.
function MoverValueLabel({ x, y, width, height, value }) {
  const inside = width >= 46;
  const negative = value < 0;
  const pad = 6;
  const tip = negative ? x : x + width;
  return (
    <text
      x={negative ? (inside ? tip + pad : tip - pad) : inside ? tip - pad : tip + pad}
      y={y + height / 2}
      fill={inside ? "#fff" : "var(--text-muted)"}
      fontSize={11}
      textAnchor={negative === inside ? "start" : "end"}
      dominantBaseline="central"
    >
      {`${value > 0 ? "+" : ""}${value}%`}
    </text>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-note">{note}</span>
    </div>
  );
}

function formatDayLabel(isoDay) {
  const [, month, day] = isoDay.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${names[Number(month) - 1]}`;
}

function formatSince(value) {
  if (!value) return "never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export default function Dashboard() {
  const narrow = useIsNarrow();
  const { data: products = [], isLoading: loading } = useQuery({ queryKey: ["products"], queryFn: api.getProducts });
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard", WINDOW_DAYS],
    queryFn: () => api.getDashboard(WINDOW_DAYS),
  });

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

  // Biggest movers first, shortened for the axis. Capped, and the cap is stated below
  // the chart rather than left to look like the whole set.
  const MOVER_LIMIT = 10;
  const movers = dashboard?.priceMovers ?? [];
  const nameLimit = narrow ? 18 : 34;
  const topMovers = useMemo(
    () =>
      movers.slice(0, MOVER_LIMIT).map((m) => ({
        ...m,
        label: m.name.length > nameLimit ? `${m.name.slice(0, nameLimit - 1)}…` : m.name,
      })),
    [movers, nameLimit]
  );

  const stockByDay = dashboard?.stockByDay ?? [];

  if (loading) return <Loader />;

  const totalProducts = products.length;
  const outOfStockNow = products.filter((p) => p.lastStock === "out_of_stock").length;
  const lastChecked = products.reduce(
    (latest, p) => (p.lastCheckedAt && (!latest || new Date(p.lastCheckedAt) > new Date(latest)) ? p.lastCheckedAt : latest),
    null
  );

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: "var(--text-muted)", marginTop: -8 }}>A quick visual overview across every tracked product.</p>

      {/* Four numbers that need no chart to be read. A stat tile beats a plot whenever
          the answer is a single figure — the plot would only be decoration around it. */}
      <div className="stat-row">
        <StatTile label="Tracked products" value={totalProducts} note={`${siteCounts.length} marketplaces`} />
        <StatTile
          label="Out of stock now"
          value={outOfStockNow}
          note={totalProducts ? `${Math.round((outOfStockNow / totalProducts) * 100)}% of listings` : "—"}
        />
        <StatTile label={`Price moves (${WINDOW_DAYS}d)`} value={movers.length} note="products that changed price" />
        <StatTile label="Last check" value={formatSince(lastChecked)} note="most recent successful check" />
      </div>

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

      <div className="chart-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Stock-status split</h3>
          <p style={{ color: "var(--text-muted)", marginTop: -8, fontSize: 13 }}>Where every tracked listing stands right now.</p>
          {statusDistribution.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No products tracked yet.</p>
          ) : (
            // A donut rather than a pie so the hole can carry the total. The arcs read
            // the same either way; the difference is that a pie wastes its middle.
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    label={renderSlicePercent}
                    labelLine={false}
                  >
                    {statusDistribution.map((entry) => (
                      // A 2px surface-coloured ring keeps touching arcs from reading as
                      // one shape where two similar statuses meet.
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v} products`} />} />
                  <Legend verticalAlign="bottom" height={30} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
              {/* Overlaid rather than drawn inside the SVG: recharts has no slot for a
                  centre label, and an absolutely positioned node keeps the text using
                  real page typography instead of SVG text metrics. */}
              <div className="donut-centre">
                <span className="donut-centre-value">{totalProducts}</span>
                <span className="donut-centre-label">tracked</span>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Out of stock over time</h3>
          <p style={{ color: "var(--text-muted)", marginTop: -8, fontSize: 13 }}>
            Listings unavailable at the end of each day, last {WINDOW_DAYS} days.
          </p>
          {stockByDay.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No stock history recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={stockByDay} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDayLabel}
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
                {/* The count alone would mislead while the catalogue is still growing —
                    9 of 56 and 9 of 69 are not the same situation — so the denominator
                    travels with it in the tooltip. */}
                <Tooltip
                  content={
                    <CustomTooltip
                      formatter={(v, row) => `${v} out of stock of ${row.tracked} tracked`}
                    />
                  }
                  labelFormatter={formatDayLabel}
                />
                <Line
                  type="monotone"
                  dataKey="outOfStock"
                  stroke={PROBLEM_BAR_COLOR}
                  strokeWidth={2}
                  dot={{ r: 4, fill: PROBLEM_BAR_COLOR, stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Biggest price moves</h3>
        <p style={{ color: "var(--text-muted)", marginTop: -8, fontSize: 13 }}>
          Change from the first to the last recorded price in the last {WINDOW_DAYS} days. Bars right of the
          line went up, left went down.
        </p>
        {topMovers.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No price changed in the last {WINDOW_DAYS} days.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, topMovers.length * 34 + 40)}>
              {/* Horizontal, because the categories are long product names — vertical
                  bars would force those names to rotate or truncate. */}
              <BarChart
                data={topMovers}
                layout="vertical"
                margin={{ top: 8, right: narrow ? 12 : 56, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={narrow ? 118 : 230}
                  tick={{ fontSize: 11, fill: "var(--text)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={
                    <CustomTooltip
                      formatter={(v, row) => `${row.site}: ₹${row.first} → ₹${row.last} (${v > 0 ? "+" : ""}${v}%)`}
                    />
                  }
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                />
                {/* The zero line is the whole reference for a diverging bar — without it
                    the direction of a short bar is guesswork. */}
                <ReferenceLine x={0} stroke="var(--text-muted)" strokeWidth={1} />
                <Bar dataKey="changePct" maxBarSize={20} radius={[3, 3, 3, 3]}>
                  {topMovers.map((m) => (
                    <Cell key={m.id} fill={m.changePct > 0 ? UP_COLOR : DOWN_COLOR} />
                  ))}
                  {/* Signed labels, so direction survives for anyone who cannot separate
                      the two hues — colour is never the only encoding here. */}
                  <LabelList
                    dataKey="changePct"
                    content={narrow ? MoverValueLabel : undefined}
                    position={narrow ? undefined : "right"}
                    formatter={narrow ? undefined : (v) => `${v > 0 ? "+" : ""}${v}%`}
                    fill="var(--text-muted)"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {movers.length > MOVER_LIMIT && (
              <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 0" }}>
                Showing the {MOVER_LIMIT} largest moves of {movers.length}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
