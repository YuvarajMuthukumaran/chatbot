import { motion } from "framer-motion";

// The frosted card every non-chat page sits in (same as Find a Doctor): a
// fixed header area and a scrolling body.
export default function PageShell({ title, subtitle, header, children, bodyClassName = "" }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-2 py-2 sm:px-6 sm:py-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass depth-shadow relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl"
      >
        {(title || header) && (
          <div className="shrink-0 border-b border-slate-100 px-4 py-4 sm:px-6">
            {title && <h1 className="text-lg font-bold text-blue-900">{title}</h1>}
            {subtitle && <p className="text-sm text-blue-600/70">{subtitle}</p>}
            {header}
          </div>
        )}
        <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 ${bodyClassName}`}>{children}</div>
      </motion.div>
    </div>
  );
}
