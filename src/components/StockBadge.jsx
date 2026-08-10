const LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  unknown: "Unknown",
};

export default function StockBadge({ status, quantity }) {
  const key = status && LABELS[status] ? status : "unknown";
  return (
    <span className={`badge ${key}`}>
      {LABELS[key]}
      {quantity != null ? ` (${quantity})` : ""}
    </span>
  );
}
