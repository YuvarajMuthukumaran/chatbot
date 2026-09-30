import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDoctor, fetchSlots, createAppointment } from "../lib/bookingApi.js";
import { localIsoDate, addDaysIso, formatSlot, formatDay, cleanPhoneInput, tenDigitPhone } from "../lib/format.js";
import { specialtyLabel } from "../lib/specialties.js";

// Mirrors BOOKING_WINDOW_DAYS on the server.
const BOOKING_WINDOW_DAYS = 90;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function DoctorProfile() {
  const { id } = useParams();

  const [doctor, setDoctor] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [date, setDate] = useState(localIsoDate());
  const [slots, setSlots] = useState(null);
  const [slotsError, setSlotsError] = useState(null);
  const [time, setTime] = useState(null);
  const [slotsVersion, setSlotsVersion] = useState(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    fetchDoctor(id)
      .then((data) => setDoctor(data.doctor))
      .catch((err) => setLoadError(err.message || "Could not load this doctor."));
  }, [id]);

  useEffect(() => {
    if (!date) return;
    let current = true;
    setSlots(null);
    setSlotsError(null);
    setTime(null);
    fetchSlots(id, date)
      .then((data) => current && setSlots(data.slots))
      .catch((err) => current && setSlotsError(err.message || "Could not load available times."));
    return () => {
      current = false; // ignore a slower response for a date that's no longer selected
    };
  }, [id, date, slotsVersion]);

  const handleBook = async (e) => {
    e.preventDefault();
    const mobile = tenDigitPhone(phone);
    if (!time || !name.trim() || !mobile) return;
    setBooking(true);
    setBookError(null);
    try {
      const { appointment } = await createAppointment({
        doctorId: id,
        doctorName: doctor.name,
        patientName: name.trim(),
        patientPhone: mobile,
        date,
        time,
      });
      setConfirmed(appointment);
    } catch (err) {
      setBookError(err.message || "Could not book the appointment.");
      // Someone else took that time in the meantime — show what's left.
      if (err.status === 409) setSlotsVersion((v) => v + 1);
    } finally {
      setBooking(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-crisis-dark">{loadError}</p>
        <Link to="/doctors" className="text-sm font-semibold text-blue-700 underline">
          Back to doctor search
        </Link>
      </div>
    );
  }

  const today = localIsoDate();

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <Link to="/doctors" className="text-sm font-medium text-blue-600 hover:underline">
            ← Back to doctors
          </Link>

          {!doctor ? (
            <div className="mt-4 animate-pulse space-y-3">
              <div className="h-16 w-16 rounded-full bg-slate-200" />
              <div className="h-5 w-1/2 rounded bg-slate-200" />
              <div className="h-24 rounded-2xl bg-slate-200" />
            </div>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                {doctor.photo ? (
                  <img src={doctor.photo} alt={doctor.name} className="h-16 w-16 rounded-full object-cover ring-1 ring-blue-100" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
                    {doctor.name.replace(/^(Dr\.|Ms\.|Mr\.)\s*(\([^)]*\)\s*)?/i, "").charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="text-lg font-bold text-blue-900">{doctor.name}</h1>
                  <p className="text-sm text-blue-600/80">{doctor.role}</p>
                </div>
              </div>

              {doctor.focus && <p className="mt-3 text-sm text-slate-600">{doctor.focus}</p>}

              {doctor.specialties?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {doctor.specialties.map((s) => (
                    <span key={s} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {specialtyLabel(s)}
                    </span>
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                {confirmed ? (
                  <motion.div
                    key="confirmed"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-center"
                    role="status"
                  >
                    <div className="text-2xl" aria-hidden="true">
                      ✅
                    </div>
                    <h2 className="mt-2 font-semibold text-green-900">You're booked!</h2>
                    <p className="mt-1 text-sm text-green-800">
                      {doctor.name} — {formatDay(confirmed.date)} at {formatSlot(confirmed.time)}
                    </p>
                    <p className="mt-1 text-xs text-green-800/80">You can view, reschedule, or cancel it under My Appointments with the same mobile number.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <Link to="/appointments" className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                        View My Appointments
                      </Link>
                      <Link to="/doctors" className="rounded-full border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                        Book Another
                      </Link>
                    </div>
                  </motion.div>
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleBook}
                    className="mt-6 space-y-4 border-t border-slate-100 pt-5"
                  >
                    <h2 className="font-semibold text-blue-900">Book an appointment</h2>

                    <div>
                      <label htmlFor="booking-date" className="mb-1 block text-sm font-medium text-slate-700">
                        Date
                      </label>
                      <input
                        id="booking-date"
                        type="date"
                        value={date}
                        min={today}
                        max={addDaysIso(today, BOOKING_WINDOW_DAYS)}
                        onChange={(e) => setDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <span id="booking-time-label" className="mb-1 block text-sm font-medium text-slate-700">
                        Time
                      </span>
                      {slotsError && <p className="text-sm text-crisis-dark">{slotsError}</p>}
                      {!slotsError && slots === null && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Loading available times">
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="h-9 animate-pulse rounded-xl bg-slate-200" />
                          ))}
                        </div>
                      )}
                      {!slotsError && slots?.length === 0 && (
                        <p className="text-sm text-slate-500">
                          No open slots on {formatDay(date)}.{" "}
                          <button type="button" onClick={() => setDate(addDaysIso(date, 1))} className="font-semibold text-blue-700 underline">
                            Try the next day
                          </button>
                        </p>
                      )}
                      {!slotsError && slots?.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="group" aria-labelledby="booking-time-label">
                          {slots.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setTime(t);
                                setBookError(null);
                              }}
                              aria-pressed={time === t}
                              className={`rounded-xl border px-2 py-2 text-xs font-semibold transition-colors ${
                                time === t
                                  ? "border-blue-700 bg-blue-700 text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                              }`}
                            >
                              {formatSlot(t)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Outside the details block: after a "just taken" error the
                        times refresh and the selection clears, but the reason
                        should stay visible. */}
                    {bookError && (
                      <p className="text-sm text-crisis-dark" role="alert">
                        {bookError}
                      </p>
                    )}

                    {time && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                        <div>
                          <label htmlFor="booking-name" className="mb-1 block text-sm font-medium text-slate-700">
                            Patient name
                          </label>
                          <input
                            id="booking-name"
                            value={name}
                            autoComplete="name"
                            maxLength={80}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label htmlFor="booking-phone" className="mb-1 block text-sm font-medium text-slate-700">
                            Mobile number
                          </label>
                          <input
                            id="booking-phone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            value={phone}
                            onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
                            placeholder="10-digit mobile number"
                            className={inputClass}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={booking || !name.trim() || !tenDigitPhone(phone)}
                          className="w-full rounded-full bg-blue-700 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {booking ? "Booking…" : `Confirm ${formatDay(date)} at ${formatSlot(time)}`}
                        </button>
                      </motion.div>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
