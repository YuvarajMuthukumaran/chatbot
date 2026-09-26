export default function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Tulasi is typing">
      <div className="flex gap-1.5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-blue-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
