import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";

// Every supported site resolves price/stock automatically (structured data, or a
// built-in fallback selector on the server for sites like JioMart that need one) —
// the form only ever needs a name, site, and URL.
const EMPTY_FORM = { name: "", site: "shopify", url: "", flipkartSku: "" };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProducts(await api.getProducts());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const product = await api.createProduct(form);
      setForm(EMPTY_FORM);
      // Fetch price/stock immediately so the row doesn't sit at "Unknown"/"never"
      // until the next scheduled check.
      await api.checkNow(product._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
      load();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this product from tracking?")) return;
    await api.deleteProduct(id);
    load();
  }

  async function handleCheckNow(id) {
    setBusyId(id);
    try {
      await api.checkNow(id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>Tracked products</h2>
      {error && <div className="card" style={{ color: "#a71d1d" }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add product</h3>
        <form onSubmit={handleAdd}>
          <div className="form-row">
            <input
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })}>
              <option value="shopify">Shopify</option>
              <option value="woocommerce">WooCommerce/WordPress</option>
              <option value="flipkart">Flipkart</option>
              <option value="meesho">Meesho</option>
              <option value="jiomart">JioMart</option>
              <option value="tira">Tira</option>
              <option value="nykaa">Nykaa</option>
              <option value="snapdeal">Snapdeal</option>
              <option value="purplle">Purplle</option>
            </select>
          </div>
          <div className="form-row">
            <input
              placeholder="Product URL (paste the normal page link)"
              style={{ flex: "1 1 240px", minWidth: 0 }}
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              required
            />
          </div>
          {form.site === "flipkart" && (
            <div className="form-row">
              <input
                placeholder="Flipkart SKU (optional — enables exact stock via Seller API)"
                style={{ flex: "1 1 240px", minWidth: 0 }}
                value={form.flipkartSku}
                onChange={(e) => setForm({ ...form, flipkartSku: e.target.value })}
              />
            </div>
          )}
          <button className="btn" type="submit" disabled={adding}>
            {adding ? "Adding & checking..." : "Add product"}
          </button>
        </form>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : products.length === 0 ? (
          <p>No products tracked yet — add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Site</th>
                <th>Last price</th>
                <th>Stock</th>
                <th>Last checked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td><Link to={`/products/${p._id}`}>{p.name}</Link></td>
                  <td>{p.site}</td>
                  <td>{p.lastPrice != null ? `₹${p.lastPrice}` : "—"}</td>
                  <td><StockBadge status={p.lastStock} quantity={p.lastStockQuantity} /></td>
                  <td>{p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleString() : "never"}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn secondary" disabled={busyId === p._id} onClick={() => handleCheckNow(p._id)}>
                      {busyId === p._id ? "Checking..." : "Check now"}
                    </button>
                    <button className="btn danger" onClick={() => handleDelete(p._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
