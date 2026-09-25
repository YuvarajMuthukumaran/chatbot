import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import CrisisButton from "./CrisisButton.jsx";
import FontSizeControl from "./FontSizeControl.jsx";
import logo from "../assets/tulasi-logo.webp";

export default function Layout() {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden text-slate-100">
      <div className="ambient-bg">
        <div className="ambient-blob-3" />
      </div>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900 focus:shadow"
      >
        Skip to main content
      </a>

      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="glass depth-shadow relative z-20 mx-2 mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl px-3 py-2 sm:mx-6 sm:mt-4 sm:px-4 sm:py-2.5"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src={logo}
            alt="Tulasi Health Care"
            className="h-8 w-8 rounded-xl object-cover shadow-lg shadow-black/30 sm:h-11 sm:w-11"
          />
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-white text-glow sm:text-base">
              YUVARAJ
            </div>
            <div className="text-[9px] font-medium uppercase tracking-wider text-teal-200/80 sm:text-[11px]">
              A Tulasi Health Care Initiative
            </div>
          </div>
        </div>

        <FontSizeControl />
      </motion.header>

      <main id="main-content" className="relative z-10 flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="relative z-10 shrink-0 px-3 py-1.5 text-center text-[10px] leading-snug text-slate-400/80 sm:py-2 sm:text-xs xl:pr-56">
        <p className="mx-auto max-w-2xl">
          <span className="xl:hidden">Not a therapist, doctor, or emergency service.</span>
          <span className="hidden xl:inline">
            Not a therapist or emergency service. If you are in immediate danger, use the{" "}
            <span className="font-semibold text-slate-300">Get Immediate Help</span> button or contact
            local emergency services.
          </span>
        </p>
      </footer>

      <CrisisButton />
    </div>
  );
}
