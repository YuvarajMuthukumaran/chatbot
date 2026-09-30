import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchMyAppointments,
  fetchSlots,
  cancelAppointmentApi,
  rescheduleAppointmentApi,
} from "../lib/bookingApi.js";
import { localIsoDate, addDaysIso, formatSlot, formatDay, cleanPhoneInput, tenDigitPhone } from "../lib/format.js";

// Mirrors BOOKING_WINDOW_DAYS on the server.
const BOOKING_WINDOW_DAYS = 90;

function AppointmentCard({ appt, isPast, onCancelled, onRescheduled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(localIsoDate());
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState(null);

  const isCancelled = appt.status === "cancelled";
  const status = isCancelled ? "Cancelled" : isPast ? "Past" : "Booked";

  const loadSlots = async (newDate) => {
    setDate(newDate);
    setSlots(null);
    setTime(null);
    setError(null);
    if (!newDate) return;
    try {
      const data = await fetchSlots(appt.doctorId, newDate);
      setSlots(data.slots);
    } catch (err) {
      setSlots([]);
      setError(err.message);
    }
  };

  const openReschedule = () => {
    setRescheduling(true);
    // Load today's times straight away — before, the picker showed loading
    // placeholders forever until a different date was chosen.
    loadSlots(localIsoDate());
  };

  const handleCancel = async () => {
    if (!window.confirm(`Cancel your appointment with ${appt.doctorName} on ${formatDay(appt.date)} at ${formatSlot(appt.time)}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await cancelAppointmentApi(appt._id);
      onCancelled(appt._id);
    } catch (err) {
      setError(err.message || "Could not cancel this appointment.");
    } finally {
      setBusy(false);
    }
  };

  const handleReschedule = async () => {
    if (!time) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleAppointmentApi(appt._id, { date, time });
      onRescheduled(appt._id, { date, time });
      setRescheduling(false);
    } catch (err) {
      setError(err.message || "Could not reschedule this appointment.");
      if (err.status === 409) loadSlots(date);
    } finally {
      setBusy(false);
    }
  };

  const today = localIsoDate();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`glass depth-shadow rounded-2xl p-4 ${isCancelled || isPast ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-blue-900">{appt.doctorName}</div>
          <div className="text-sm text-blue-600/80">
            {formatDay(appt.date)} at {formatSlot(appt.time)}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            status === "Booked" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          {status}
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-crisis-dark">{error}</p>}

      {status === "Booked" && !rescheduling && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={openReschedule}
            disabled={busy}
            className="rounded-full border border-blue-200 px-3.5 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="rounded-full border border-crisis/30 px-3.5 py-1.5 text-sm font-semibold text-crisis-dark hover:bg-crisis/5 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      <AnimatePresence>
        {rescheduling && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2 overflow-hidden border-t border-slate-100 pt-3"
          >
            <label htmlFor={`reschedule-date-${appt._id}`} className="block text-sm font-medium text-slate-700">
              New date
            </label>
            <input
              id={`reschedule-date-${appt._id}`}
              type="date"
              value={date}
              min={today}
              max={addDaysIso(today, BOOKING_WINDOW_DAYS)}
              onChange={(e) => loadSlots(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {slots === null && (
              <div className="grid grid-cols-4 gap-1.5" aria-label="Loading available times">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            )}
            {slots?.length === 0 && !error && <p className="text-sm text-slate-500">No open slots that day — try another date.</p>}
            {slots?.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="group" aria-label="Available times">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    aria-pressed={time === t}
                    className={`rounded-lg border px-1.5 py-1.5 text-xs font-semibold ${
                      time === t ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {formatSlot(t)}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleReschedule}
                disabled={!time || busy}
                className="rounded-full bg-blue-700 px-3.5 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save new time"}
              </button>
              <button
                type="button"
                onClick={() => setRescheduling(false)}
                className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-600"
              >
                Keep current time
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function MyAppointments() {
  const [phone, setPhone] = useState("");
  const [appointments, setAppointments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    const mobile = tenDigitPhone(phone);
    if (!mobile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyAppointments(mobile);
      setAppointments(data.appointments);
    } catch (err) {
      setError(err.message || "Could not load your appointments.");
    } finally {
      setLoading(false);
    }
  };

  const today = localIsoDate();
  const upcoming = (appointments || []).filter((a) => a.date >= today);
  // Most recent first for the past ones.
  const past = (appointments || []).filter((a) => a.date < today).reverse();

  const update = (id, changes) => setAppointments((prev) => prev.map((x) => (x._id === id ? { ...x, ...changes } : x)));

  const renderList = (list, isPast) => (
    <div className="space-y-3">
      <AnimatePresence>
        {list.map((a) => (
          <AppointmentCard
            key={a._id}
            appt={a}
            isPast={isPast}
            onCancelled={(id) => update(id, { status: "cancelled" })}
            onRescheduled={(id, { date, time }) => update(id, { date, time })}
          />
        ))}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-blue-900">My Appointments</h1>
          <form onSubmit={handleLookup} className="mt-3 flex gap-2">
            <label htmlFor="lookup-phone" className="sr-only">
              Mobile number you booked with
            </label>
            <input
              id="lookup-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
              placeholder="Enter your 10-digit mobile number"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              disabled={loading || !tenDigitPhone(phone)}
              className="shrink-0 rounded-full bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {loading ? "Looking…" : "Find"}
            </button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {error && (
            <p className="text-sm text-crisis-dark" role="alert">
              {error}
            </p>
          )}
          {!error && appointments === null && (
            <p className="py-10 text-center text-sm text-slate-500">Enter your mobile number to see your appointments.</p>
          )}
          {!error && appointments?.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">No appointments found for that number.</p>
          )}
          {!error && appointments?.length > 0 && (
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-semibold text-slate-600">Upcoming</h2>
                {upcoming.length ? renderList(upcoming, false) : <p className="text-sm text-slate-500">Nothing coming up.</p>}
              </section>
              {past.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-semibold text-slate-600">Past</h2>
                  {renderList(past, true)}
                </section>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
