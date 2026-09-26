import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCrisisResources } from "../lib/crisisResources.js";

export default function CrisisButton() {
  const [open, setOpen] = useState(false);
  const resources = getCrisisResources();

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Get immediate help — crisis resources"
        animate={{ scale: [1, 1.06, 1], boxShadow: ["0 0 0 0 rgba(220,38,38,0.35)", "0 0 0 14px rgba(220,38,38,0)", "0 0 0 0 rgba(220,38,38,0)"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.96 }}
        className="fixed right-3 top-20 z-50 flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-crisis to-crisis-dark font-semibold text-white shadow-lg shadow-crisis/30 ring-1 ring-white/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-crisis/40 xl:right-6 xl:top-auto xl:bottom-6 xl:h-auto xl:w-auto xl:px-5 xl:py-3"
      >
        <span aria-hidden="true" className="text-xl xl:text-base">☎</span>
        <span className="hidden xl:inline">Get Immediate Help</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crisis-dialog-title"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96, rotateX: -6 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              style={{ perspective: 1000 }}
              className="glass depth-shadow max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border-crisis/20 p-5 sm:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="crisis-dialog-title" className="text-xl font-bold text-crisis-dark">
                You deserve support right now
              </h2>
              <p className="mt-2 text-slate-600">
                If you're in immediate danger, please contact emergency services. Otherwise, these are
                reachable right now, free of charge, in {resources.label}:
              </p>
              <ul className="mt-4 space-y-3">
                {resources.lines.map((line) => (
                  <li key={line.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="font-semibold text-slate-800">{line.name}</div>
                    {line.type === "call" ? (
                      <a
                        href={`tel:${line.phone.replace(/[^\d+]/g, "")}`}
                        className="text-blue-700 underline decoration-blue-300 underline-offset-2"
                      >
                        {line.phone}
                      </a>
                    ) : (
                      <span className="text-blue-700">{line.phone}</span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-5 w-full rounded-full bg-blue-700 py-2.5 font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
