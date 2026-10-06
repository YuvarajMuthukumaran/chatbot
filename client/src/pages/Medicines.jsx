import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import PageShell from "../components/PageShell.jsx";
import { fetchMedicines } from "../lib/guideApi.js";

export function MedicineDisclaimer({ className = "" }) {
  return (
    <div className={`flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-900 ${className}`}>
      <span aria-hidden="true" className="text-lg">⚠️</span>
      <p>
        <span className="font-semibold">General information only.</span> Everyone responds differently. Never start, stop or change a medicine without your
        doctor. If you think you're having a serious reaction, get medical help right away.
      </p>
    </div>
  );
}

export default function Medicines() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const category = params.get("category") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMedicines()
      .then(setData)
      .catch((err) => setError(err.message || "Could not load the medicine guide."));
  }, []);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const categories = data?.categories || [];
  const categoryById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const shown = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.medicines.filter(
      (m) =>
        (!category || m.category === category) &&
        (!q || m.name.toLowerCase().includes(q) || m.kind.toLowerCase().includes(q) || m.usedFor.some((u) => u.toLowerCase().includes(q)))
    );
  }, [data, search, category]);

  const chip = (active) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
      active ? "bg-blue-700 text-white shadow-sm" : "bg-white/80 text-blue-700 ring-1 ring-blue-100 hover:bg-blue-50"
    }`;

  return (
    <PageShell
      title="Medicine guide"
      subtitle="What common mental-health medicines are for, how they can help, and what to watch for."
      header={
        <div className="mt-3 space-y-3">
          <label htmlFor="medicine-search" className="sr-only">
            Search medicines or conditions
          </label>
          <input
            id="medicine-search"
            type="search"
            value={search}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search a medicine or a condition, e.g. sertraline, anxiety…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by type">
            <button type="button" className={chip(!category)} onClick={() => setFilter("category", "")} aria-pressed={!category}>
              All
            </button>
            {categories.map((c) => (
              <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => setFilter("category", c.id)} aria-pressed={category === c.id}>
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <MedicineDisclaimer className="mb-4" />

      {error && (
        <div className="rounded-xl border border-crisis/20 bg-crisis/5 px-4 py-3 text-sm text-crisis-dark" role="alert">
          {error}
        </div>
      )}

      {!error && !data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass depth-shadow h-36 animate-pulse rounded-2xl" />
          ))}
        </div>
      )}

      {data && shown.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">
          No medicines match that. Try another name, or{" "}
          <Link to="/" className="font-medium text-blue-700 underline underline-offset-2">
            ask Tulasi
          </Link>
          .
        </p>
      )}

      {data && shown.length > 0 && (
        <>
          <p className="mb-3 text-xs font-medium text-slate-500" aria-live="polite">
            {shown.length} {shown.length === 1 ? "medicine" : "medicines"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((m, i) => (
              <motion.div
                key={m.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: "easeOut" }}
              >
                <Link
                  to={`/medicines/${m.slug}`}
                  className="glass depth-shadow group flex h-full flex-col gap-2.5 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-lavender-100 text-xl">
                      {categoryById[m.category]?.icon || "💊"}
                    </span>
                    <div className="min-w-0">
                      <div className="break-words font-semibold leading-snug text-blue-900">{m.name}</div>
                      <div className="text-xs text-slate-500">{m.kind}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.usedFor.slice(0, 3).map((u) => (
                      <span key={u} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {u}
                      </span>
                    ))}
                    {m.usedFor.length > 3 && <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">+{m.usedFor.length - 3}</span>}
                  </div>
                  <span className="mt-auto pt-1 text-xs font-semibold text-blue-700 group-hover:underline">Read the guide →</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
