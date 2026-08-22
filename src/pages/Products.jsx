import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { api } from "../api";
import StockBadge from "../components/StockBadge.jsx";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Pager, usePagination } from "../components/Pager.jsx";

// Every supported site resolves price/stock automatically (structured data, or a
// built-in fallback selector on the server for sites like JioMart that need one) —
// the form only ever needs a name, site, and URL.
// The floor, editable where it is read. Setting one is a per-listing judgement made
// while looking at that listing's price, so making it a row-level control saves opening
// the edit form for a single number.
//
// The draft is held separately from the saved value so the field does not snap back
// mid-typing when the table refetches, and is dropped once saved so the row goes back to
// showing what the server holds. Clearing the box and saving removes the floor — that is
// the only way to take one off, so the button stays live for an empty box that used to
// have a value.
function TargetPriceCell({ product, draft, onDraft, onSave, saving, guard }) {
  const stored = product.targetPrice ?? "";
  const value = draft ?? String(stored);
  const dirty = value.trim() !== String(stored);
  const breached =
    product.targetPrice != null && product.lastPrice != null && product.lastPrice < product.targetPrice;

  return (
    <div className="target-cell">
      <input
        type="number"
        min="0"
        step="1"
        className={breached && !dirty ? "below-target" : undefined}
        title={breached ? `₹${Math.round((product.targetPrice - product.lastPrice) * 100) / 100} below target` : "No target set"}
        placeholder="—"
        value={value}
        onChange={(e) => onDraft(product._id, e.target.value)}
        disabled={saving}
      />
      <button
        className="btn secondary"
        disabled={!dirty || saving}
        onClick={guard(() => onSave(product._id, value))}
      >
        {saving ? "…" : product.targetPrice == null ? "Save" : "Update"}
      </button>
    </div>
  );
}

// A header that sorts. The arrow only appears on the column actually in use — showing a
// neutral marker on every column makes the active one harder to spot, not easier.
// aria-sort is what tells a screen reader the same thing the arrow tells everyone else.
function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`sortable${active ? " sorted" : ""}`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      <span className="sort-arrow">{active ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
    </th>
  );
}

const EMPTY_FORM = { name: "", site: "shopify", url: "", flipkartSku: "", productGroup: "", targetPrice: "" };
const SITE_OPTIONS = ["shopify", "woocommerce", "flipkart", "meesho", "jiomart", "tira", "nykaa", "snapdeal", "purplle", "myntra"];

export default function Products() {
  const { guardAction } = useAuth();
  const queryClient = useQueryClient();
  // staleTime here (set globally in main.jsx) means revisiting this page shows
  // whatever was cached from last time instantly — no loading spinner — while quietly
  // refetching in the background if it's gone stale. invalidate() below (after any
  // mutation) forces an immediate refetch regardless of staleness.
  const { data: products = [], isLoading: loading } = useQuery({ queryKey: ["products"], queryFn: api.getProducts });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["products"] });

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkCheckProgress, setBulkCheckProgress] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "name", dir: "asc" });
  const [targetDrafts, setTargetDrafts] = useState({});
  const [savingTarget, setSavingTarget] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const formCardRef = useRef(null);

  function flashSuccess(message) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage((current) => (current === message ? null : current)), 4000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const wasEditing = Boolean(editingId);
    setAdding(true);
    setError(null);
    try {
      const product = wasEditing ? await api.updateProduct(editingId, form) : await api.createProduct(form);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setAdding(false);
      // The save itself (PUT/POST) is fast — confirm success and refresh the table
      // right away instead of leaving the user staring at "Saving..." for however
      // long the price/stock check takes (a JioMart check via ScraperAPI alone can
      // take 60-100s+). The check-now below fills in price/stock in the background;
      // its own invalidate() afterward updates that once it's ready.
      flashSuccess(wasEditing ? "✅ Product updated" : "✅ Product added");
      invalidate();
      // checkNow silently fails for sites handled by local worker (meesho etc.) —
      // local worker picks them up within 2 minutes automatically
      try {
        await api.checkNow(product._id);
        invalidate();
      } catch (checkErr) {
        if (!checkErr.message?.includes("blocked from this server")) {
          setError(checkErr.message);
        }
        invalidate();
      }
    } catch (err) {
      setError(err.message);
      setAdding(false);
    }
  }

  function handleEditClick(product) {
    setEditingId(product._id);
    setForm({
      name: product.name,
      site: product.site,
      url: product.url,
      flipkartSku: product.flipkartSku || "",
      productGroup: product.productGroup || "",
      targetPrice: product.targetPrice ?? "",
    });
    // The page itself never scrolls (body { overflow: hidden }) — .main is the actual
    // scrolling container, so window.scrollTo was a no-op. scrollIntoView finds
    // whichever ancestor actually scrolls, so it works regardless of layout. Instant
    // (not "smooth") — a smooth scroll only animates while the tab is actually being
    // composited/rendered, which isn't guaranteed at the moment a click handler runs.
    formCardRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(id) {
    if (!confirm("Remove this product from tracking?")) return;
    await api.deleteProduct(id);
    invalidate();
  }

  async function handleSaveTarget(id, value) {
    setSavingTarget(id);
    setError(null);
    try {
      await api.updateProduct(id, { targetPrice: value.trim() });
      // Drop the draft so the row reads the saved value again — including the case where
      // the server stored null for an emptied box.
      setTargetDrafts((drafts) => {
        const next = { ...drafts };
        delete next[id];
        return next;
      });
      await invalidate();
    } catch (err) {
      setError(err.message || "Could not save the target price");
    } finally {
      setSavingTarget(null);
    }
  }

  async function handleCheckNow(id) {
    setBusyId(id);
    try {
      await api.checkNow(id);
      await invalidate();
    } catch (err) {
      if (err.message?.includes("blocked from this server")) {
        flashSuccess("⏳ Local worker se update hoga (2 min mein)");
      } else {
        setError(err.message);
      }
    } finally {
      setBusyId(null);
    }
  }

  // Converts a worksheet's raw rows (array-of-arrays, header included) into product
  // rows. Looks up "Product Name"/"Platform"/"Product Link" (or "Link"/"URL") by
  // *header name*, not fixed column position — the download template only has those
  // 4 columns, but a sheet like Product_List's export has extra ones in between (SKU,
  // Price/Status), and a hardcoded index silently grabbed the wrong column's text as
  // the URL. Any extra columns (Brand, SKU, Price/Status, ...) are ignored wherever
  // they sit.
  function sheetRowsToProducts(sheetRows) {
    if (sheetRows.length === 0) return [];
    const header = sheetRows[0].map((c) => String(c ?? "").trim().toLowerCase());
    const nameIdx = header.indexOf("product name");
    const platformIdx = header.indexOf("platform");
    const linkIdx = header.findIndex((h) => h === "product link" || h === "link" || h === "url");
    if (nameIdx === -1 || platformIdx === -1 || linkIdx === -1) return [];

    const rows = [];
    for (const raw of sheetRows.slice(1)) {
      const cols = raw.map((c) => String(c ?? "").trim());
      if (!cols.some(Boolean)) continue; // blank row
      const name = cols[nameIdx];
      const site = cols[platformIdx];
      const url = cols[linkIdx];
      if (!name || !site || !url) continue; // incomplete row — createProduct/bulkImport would reject it anyway
      rows.push({ name, site, url });
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
          setError("Couldn't find any valid rows in that file — use the template below (Product Name, Platform, Link columns).");
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
      ["Product Name", "Brand", "Platform", "Product Link"],
      ["KOBRA Gokshura Tablets Supplement Tablets (30 Tablets)", "KOBRA", "Flipkart", "https://www.flipkart.com/kobra-gokshura-tablets-supplement/p/itm1fc97e62f760d"],
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
    let result;
    try {
      result = await api.bulkImportProducts(bulkRows);
      setBulkResult(result);
      setBulkRows([]);
      setBulkFileName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkImporting(false);
      invalidate();
    }

    // Bulk-created products otherwise sit at "Unknown"/"never" until the next hourly
    // check — same reason a single "Add product" auto-checks immediately. Done one at
    // a time (not all at once) since each check is a full Playwright browser launch on
    // the server and could easily overload it if fired concurrently for a big import.
    if (result?.created?.length) {
      for (let i = 0; i < result.created.length; i++) {
        setBulkCheckProgress({ done: i, total: result.created.length });
        try {
          await api.checkNow(result.created[i]._id);
        } catch {
          // A single product's check failing shouldn't stop the rest from being tried.
        }
        invalidate();
      }
      setBulkCheckProgress(null);
    }
  }

  async function handleCheckAll() {
    setCheckingAll(true);
    setError(null);
    try {
      await api.checkAll();
      await invalidate();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingAll(false);
    }
  }

  const PAGE_SIZE = 25;

  // filter -> search -> sort, all before paging, so a search covers every product rather
  // than only the page currently on screen.
  const matching = products
    .filter((p) => stockFilter === "all" || (p.lastStock || "unknown") === stockFilter)
    .filter((p) => siteFilter === "all" || p.site === siteFilter)
    .filter((p) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${p.name} ${p.site} ${p.productGroup || ""}`.toLowerCase().includes(q);
    });

  // Missing values sort last whichever way the column is pointing: a product with no
  // price yet is not "the cheapest", and floating it to the top of an ascending sort
  // would bury the row someone actually wanted.
  const sorted = [...matching].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const pick = (p) => {
      if (sort.key === "price") return p.lastPrice;
      if (sort.key === "target") return p.targetPrice;
      if (sort.key === "checked") return p.lastCheckedAt ? new Date(p.lastCheckedAt).getTime() : null;
      if (sort.key === "stock") return p.lastStock || "unknown";
      if (sort.key === "site") return p.site;
      return p.name;
    };
    const x = pick(a);
    const y = pick(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    if (typeof x === "string") return x.localeCompare(y) * dir;
    return (x - y) * dir;
  });

  const { page, pageCount, visible, goToPage, topRef, total, from, to } = usePagination(sorted, {
    pageSize: PAGE_SIZE,
    resetKey: `${stockFilter}|${siteFilter}|${search}`,
  });

  function toggleSort(key) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  }

  // Exports everything the current filters and search match, not just the page on screen
  // — the button sits under a paged table, so the distinction has to be deliberate. The
  // note beside it says which.
  function handleExport() {
    const rows = sorted.map((p) => ({
      Name: p.name,
      Platform: p.site,
      "Product group": p.productGroup || "",
      "Last price": p.lastPrice ?? "",
      "Target price": p.targetPrice ?? "",
      "Below target": p.targetPrice != null && p.lastPrice != null && p.lastPrice < p.targetPrice ? "yes" : "",
      Stock: p.lastStock || "unknown",
      "Stock quantity": p.lastStockQuantity ?? "",
      "Last checked": p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleString() : "never",
      Link: p.url,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Products");
    XLSX.writeFile(book, `price-tracker-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <h2>Tracked products</h2>
      {error && <div className="card" style={{ color: "#a71d1d" }}>{error}</div>}
      {successMessage && <div className="card" style={{ color: "#1a7f37" }}>{successMessage}</div>}

      <div className="card" ref={formCardRef}>
        <h3 style={{ marginTop: 0 }}>{editingId ? "Edit product" : "Add product"}</h3>
        <form
          onSubmit={guardAction(handleSubmit)}
          // Pressing Enter in any text field (e.g. mid-edit, or an autocomplete
          // suggestion) submits the form by default HTML behavior — since the save
          // itself is fast, this silently saved+reset the form before the edit was
          // finished, which read as "the form randomly kicks me out" with no obvious
          // cause. Only the actual submit button should trigger a save.
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") e.preventDefault();
          }}
        >
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
              <option value="myntra">Myntra</option>
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
          {/* The link between the same product on two marketplaces. Nothing else in the
              data says the Flipkart listing and the JioMart listing are the same thing,
              and their titles are usually too different to match automatically, so the
              dashboard's price comparison only sees listings that share a group. Any
              label works as long as it is spelled the same on each listing. */}
          <div className="form-row">
            <input
              placeholder='Product group (optional — same label on each marketplace, e.g. "multivitamin mango")'
              style={{ flex: "1 1 320px", minWidth: 0 }}
              value={form.productGroup}
              onChange={(e) => setForm({ ...form, productGroup: e.target.value })}
              list="product-groups"
            />
            {/* The floor this listing should not be discounted below. Left empty means no
                floor — see the model, which turns "" into NULL rather than 0. */}
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Target price ₹ (optional — alert if it drops below)"
              style={{ flex: "1 1 260px", minWidth: 0 }}
              value={form.targetPrice}
              onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
            />
            {/* Existing groups, so a second listing is picked from the list rather than
                retyped — a typo would silently split the pair instead of joining it. */}
            <datalist id="product-groups">
              {[...new Set(products.map((p) => p.productGroup).filter(Boolean))].sort().map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </div>
          <div className="form-row">
            <button className="btn" type="submit" disabled={adding}>
              {adding ? (editingId ? "Saving & checking..." : "Adding & checking...") : editingId ? "Save changes" : "Add product"}
            </button>
            {editingId && (
              <button type="button" className="btn secondary" onClick={handleCancelEdit} disabled={adding}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Bulk import</h3>
        <p style={{ marginTop: 0, color: "#666" }}>
          Upload an Excel file with Product Name, Platform and Link columns (a Brand column in
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
          <button className="btn" disabled={bulkImporting || bulkRows.length === 0} onClick={guardAction(handleBulkImport)}>
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
          </div>
        )}
        {bulkCheckProgress && (
          <p style={{ color: "#666", fontSize: 13 }}>
            Fetching price/stock for new products: {bulkCheckProgress.done}/{bulkCheckProgress.total}...
          </p>
        )}
      </div>

      <div className="card">
        {loading ? (
          <Loader />
        ) : products.length === 0 ? (
          <p>No products tracked yet — add one above.</p>
        ) : (
          <>
            {/* One row rather than nested ones: the filters, the search and the two
                actions all belong to the same toolbar, and nesting them made the row
                wrap into two lines well before it ran out of width. The search is the
                only thing that grows, since it is the only one whose useful size varies
                with the space available. */}
            <div className="form-row" ref={topRef}>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">All stock statuses</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="unknown">Unknown</option>
              </select>
              <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                <option value="all">All sites</option>
                {SITE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Search name, platform or group"
                style={{ flex: "1 1 200px", minWidth: 0 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn secondary" onClick={handleExport} disabled={sorted.length === 0}>
                Export to Excel
              </button>
              <button className="btn" disabled={checkingAll} onClick={guardAction(handleCheckAll)}>
                {checkingAll ? "Checking all products..." : "Check all products"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>
              {total === products.length ? `${products.length} products` : `${total} of ${products.length} products match`}
              {pageCount > 1 ? ` — showing ${from}–${to}. Export takes all ${total}.` : ""}
            </p>
            <div className="table-scroll">
            <table className="table-products">
            {/* Explicit per-column pixel widths (rather than CSS percentages) guarantee
                the header row and body rows always line up exactly — a <colgroup> is
                the one thing table-layout:fixed treats as authoritative for column
                sizing, so there's no room for header/body to drift apart. The actions
                column is wide enough for all 3 buttons (Check now/Edit/Delete) side by
                side without their text clipping, which % widths weren't guaranteeing
                on narrow/mobile viewports even inside the horizontal-scroll wrapper. */}
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 280 }} />
            </colgroup>
            <thead>
              <tr>
                <SortableTh label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
                <SortableTh label="Site" sortKey="site" sort={sort} onSort={toggleSort} />
                <SortableTh label="Last price" sortKey="price" sort={sort} onSort={toggleSort} />
                <SortableTh label="Target" sortKey="target" sort={sort} onSort={toggleSort} />
                <SortableTh label="Stock" sortKey="stock" sort={sort} onSort={toggleSort} />
                <SortableTh label="Last checked" sortKey="checked" sort={sort} onSort={toggleSort} />
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p._id}>
                  {/* The name opens the actual listing on the marketplace — that's what
                      you want when checking "is this really out of stock?". The tracker's
                      own price/stock history moves to a separate small link, since the
                      name was previously the only route to it. */}
                  <td>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" title={p.name}>
                      {p.name}
                    </a>
                    <Link
                      to={`/products/${p._id}`}
                      title="Price & stock history recorded by the tracker"
                      style={{ display: "block", fontSize: 11, marginTop: 2, color: "var(--text-muted)" }}
                    >
                      History
                    </Link>
                  </td>
                  <td>{p.site}</td>
                  <td>{p.lastPrice != null ? `₹${p.lastPrice}` : "—"}</td>
                  {/* A breach is a state, not an event: the Telegram alert fires once on
                      the crossing, so this is what shows it is still under. */}
                  <td>
                    <TargetPriceCell
                      product={p}
                      draft={targetDrafts[p._id]}
                      onDraft={(id, v) => setTargetDrafts((d) => ({ ...d, [id]: v }))}
                      onSave={handleSaveTarget}
                      saving={savingTarget === p._id}
                      guard={guardAction}
                    />
                  </td>
                  <td><StockBadge status={p.lastStock} quantity={p.lastStockQuantity} /></td>
                  <td>{p.lastCheckedAt ? new Date(p.lastCheckedAt).toLocaleString() : "never"}</td>
                  <td style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button className="btn secondary" disabled={busyId === p._id} onClick={guardAction(() => handleCheckNow(p._id))}>
                      {busyId === p._id ? "Checking..." : "Check now"}
                    </button>
                    <button className="btn secondary" onClick={guardAction(() => handleEditClick(p))}>Edit</button>
                    <button className="btn danger" onClick={guardAction(() => handleDelete(p._id))}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
            </div>
            <Pager page={page} pageCount={pageCount} onChange={goToPage} />
            {sorted.length === 0 && (
              <p style={{ color: "var(--text-muted)" }}>
                Nothing matches those filters{search ? ` and “${search}”` : ""}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
