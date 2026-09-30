import { motion } from "framer-motion";

// Tappable suggestions under the latest reply (booking steps, time slots,
// yes/no, conversation starters). Picking one just sends its text as a
// message, so anything shown here also works when typed.
export default function QuickReplies({ options, onPick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-wrap gap-2 pl-1"
      role="group"
      aria-label="Suggested replies"
    >
      {options.map((option) => {
        const subtle = option === "Never mind";
        return (
          <button
            key={option}
            type="button"
            onClick={() => onPick(option)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
              subtle
                ? "border-slate-200 bg-white/70 text-slate-500 hover:bg-slate-50"
                : "border-blue-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            {option}
          </button>
        );
      })}
    </motion.div>
  );
}
