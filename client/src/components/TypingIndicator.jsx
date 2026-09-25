export default function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="YUVARAJ is typing">
      <div className="glass-light flex gap-1.5 rounded-2xl px-4 py-3 shadow-lg shadow-black/10">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-bounce rounded-full bg-lavender-500"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
