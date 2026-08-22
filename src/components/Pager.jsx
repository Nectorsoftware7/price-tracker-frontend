import { useEffect, useMemo, useRef, useState } from "react";

// Paging, in one place, because four lists need it and the Products table had already
// grown its own copy. Two implementations of the same control drift — the role labels
// did exactly that — so the second one is this instead of another inline slice().
//
// `resetKey` is how a caller says "the underlying list changed meaning": pass the filter
// values, and narrowing them returns to page one rather than leaving the reader on a page
// that no longer exists. It is deliberately not the item count: these lists refetch in the
// background, and a single new row arriving should not throw someone off page three.
export function usePagination(items, { pageSize = 25, resetKey = "" } = {}) {
  const [page, setPage] = useState(1);
  const topRef = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamped rather than corrected in state: a list that shrinks under the current page
  // would otherwise render empty for one frame before an effect could fix it.
  const current = Math.min(page, pageCount);
  const visible = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );

  // Paging swaps a screenful out from under the reader while the viewport stays at the
  // foot of the list, where the buttons are — so the next page opens somewhere in its
  // middle. Going back to the head of the list is what makes it readable from row one.
  function goToPage(next) {
    setPage(next);
    topRef.current?.scrollIntoView({
      // Someone who asked the system to reduce motion should still be taken there, just
      // not flung.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }

  return {
    page: current,
    pageCount,
    visible,
    goToPage,
    topRef,
    total: items.length,
    from: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(current * pageSize, items.length),
  };
}

export function Pager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null;
  return (
    <div className="pager">
      <button className="btn secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span className="pager-status">
        Page {page} of {pageCount}
      </span>
      <button className="btn secondary" disabled={page === pageCount} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
