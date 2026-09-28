import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDoctors, fetchSpecialties } from "../lib/bookingApi.js";

function DoctorCard({ doctor, index }) {
  const initial = doctor.name.replace(/^(Dr\.|Ms\.|Mr\.)\s*/i, "").charAt(0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className="glass depth-shadow flex flex-col gap-3 rounded-2xl p-4"
    >
      <div className="flex items-center gap-3">
        {doctor.photo ? (
          <img src={doctor.photo} alt={doctor.name} className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-blue-100" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-semibold text-blue-700 ring-1 ring-blue-100">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold text-blue-900">{doctor.name}</div>
          <div className="truncate text-sm text-blue-600/80">{doctor.role}</div>
        </div>
      </div>

      {doctor.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {doctor.specialties.slice(0, 4).map((s) => (
            <span key={s} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              {s.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {doctor.focus && <p className="line-clamp-2 text-sm text-slate-600">{doctor.focus}</p>}

      <Link
        to={`/doctors/${doctor._id}`}
        className="mt-auto rounded-full bg-blue-700 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-800"
      >
        Book Appointment
      </Link>
    </motion.div>
  );
}

function DoctorCardSkeleton() {
  return (
    <div className="glass depth-shadow flex animate-pulse flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-slate-200" />
      <div className="h-9 rounded-full bg-slate-200" />
    </div>
  );
}

export default function Doctors() {
  const [doctors, setDoctors] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSpecialties()
      .then((data) => setSpecialties(data.specialties || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setError(null);
    const handle = setTimeout(() => {
      fetchDoctors({ search, specialty })
        .then((data) => setDoctors(data.doctors))
        .catch((err) => setError(err.message || "Could not load doctors."));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, specialty]);

  const specialtyOptions = useMemo(() => specialties.map((s) => ({ value: s, label: s.replace(/_/g, " ") })), [specialties]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-blue-900">Find a Doctor</h1>
          <p className="text-sm text-blue-600/70">Search Tulasi Health Care's specialists and book an appointment.</p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor name…"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All specialties</option>
              {specialtyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <div className="rounded-xl border border-crisis/20 bg-crisis/5 px-4 py-3 text-sm text-crisis-dark">{error}</div>
          )}

          {!error && doctors === null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <DoctorCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!error && doctors && doctors.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No doctors match those filters.</p>
          )}

          {!error && doctors && doctors.length > 0 && (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {doctors.map((d, i) => (
                  <DoctorCard key={d._id} doctor={d} index={i} />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}
