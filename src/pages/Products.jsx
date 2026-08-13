import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
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
  const [checkingAll, setCheckingAll] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

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

  // Converts a worksheet's raw rows (array-of-arrays, header included) into product
  // rows. Supports either 3 columns (Platform, Product Name, Link) or 4 (Platform,
  // Brand, Product Name, Link) — Brand is dropped either way, since the tracker has no
  // use for it. A header row (first cell "platform") is skipped.
  function sheetRowsToProducts(sheetRows) {
    const rows = [];
    for (const raw of sheetRows) {
      const cols = raw.map((c) => String(c ?? "").trim());
      if (!cols.some(Boolean)) continue; // blank row
      if (cols[0]?.toLowerCase() === "platform") continue; // header row
      if (cols.length >= 4) {
        rows.push({ site: cols[0], name: cols[2], url: cols[3] });
      } else if (cols.length === 3) {
        rows.push({ site: cols[0], name: cols[1], url: cols[2] });
      }
    }
    return rows;
  }

  function handleBulkFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBulkResult(null);
    setBulkFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        const rows = sheetRowsToProducts(sheetRows);
        if (rows.length === 0) {
          setError("Couldn't find any valid rows in that file — use the template below (Platform, Product Name, Link columns).");
        }
        setBulkRows(rows);
      } catch (err) {
        setError("Couldn't read that file — make sure it's a valid .xlsx/.xls/.csv file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleDownloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Platform", "Brand", "Product Name", "Product Link"],
      ["Flipkart", "KOBRA", "KOBRA Gokshura Tablets Supplement Tablets (30 Tablets)", "https://www.flipkart.com/kobra-gokshura-tablets-supplement/p/itm1fc97e62f760d"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, "price-tracker-bulk-import-template.xlsx");
  }

  async function handleBulkImport() {
    if (bulkRows.length === 0) return;
    setBulkImporting(true);
    setError(null);
    setBulkResult(null);
    try {
      const result = await api.bulkImportProducts(bulkRows);
      setBulkResult(result);
      setBulkRows([]);
      setBulkFileName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkImporting(false);
      load();
    }
  }

  async function handleCheckAll() {
    setCheckingAll(true);
    setError(null);
    try {
      await api.checkAll();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingAll(false);
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
        <h3 style={{ marginTop: 0 }}>Bulk import</h3>
        <p style={{ marginTop: 0, color: "#666" }}>
          Upload an Excel file with Platform, Product Name and Link columns (a Brand column in
          between is fine too, it's ignored). Not sure of the format — download the template first.
        </p>
        <div className="form-row">
          <button type="button" className="btn secondary" onClick={handleDownloadTemplate}>
            Download template
          </button>
        </div>
        <div className="form-row" style={{ marginTop: 8 }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkFileChange} />
        </div>
        {bulkFileName && (
          <p style={{ fontSize: 13, color: "#666" }}>
            {bulkFileName} — {bulkRows.length} product{bulkRows.length === 1 ? "" : "s"} found
          </p>
        )}
        <div className="form-row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={bulkImporting || bulkRows.length === 0} onClick={handleBulkImport}>
            {bulkImporting ? "Importing..." : `Import ${bulkRows.length || ""} product${bulkRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
        {bulkResult && (
          <div style={{ marginTop: 8 }}>
            <p>
              <b>{bulkResult.created.length}</b> added
              {bulkResult.skipped.length > 0 && <>, <b>{bulkResult.skipped.length}</b> skipped</>}
            </p>
            {bulkResult.skipped.length > 0 && (
              <ul style={{ color: "#a71d1d", fontSize: 13 }}>
                {bulkResult.skipped.map((s, i) => (
                  <li key={i}>{s.name || s.url || "(blank row)"} — {s.reason}</li>
                ))}
              </ul>
            )}
            {bulkResult.created.length > 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>
                Click "Check all products" below to fetch their price/stock now.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        {loading ? (
          <p>Loading...</p>
        ) : products.length === 0 ? (
          <p>No products tracked yet — add one above.</p>
        ) : (
          <>
            <div className="form-row" style={{ justifyContent: "flex-end" }}>
              <button className="btn" disabled={checkingAll} onClick={handleCheckAll}>
                {checkingAll ? "Checking all products..." : "Check all products"}
              </button>
            </div>
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
          </>
        )}
      </div>
    </div>
  );
}
