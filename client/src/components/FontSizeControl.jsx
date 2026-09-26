import { useEffect, useState } from "react";

const SCALES = ["font-scale-normal", "font-scale-large", "font-scale-xl"];
const LABELS = ["A", "A+", "A++"];
const STORAGE_KEY = "yuvaraj.fontScale";

export default function FontSizeControl() {
  const [index, setIndex] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < SCALES.length ? saved : 0;
  });

  useEffect(() => {
    document.body.classList.remove(...SCALES);
    document.body.classList.add(SCALES[index]);
    localStorage.setItem(STORAGE_KEY, String(index));
  }, [index]);

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Adjust text size">
      {LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => setIndex(i)}
          aria-pressed={index === i}
          aria-label={`Text size ${label}`}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
            index === i
              ? "bg-blue-700 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
