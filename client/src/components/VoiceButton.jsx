import { useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../lib/api.js";

// Tap to record, tap again to stop. The words land in the message box for
// the person to check before sending: a misheard word can change the
// meaning of something important, so it's never sent automatically.

const MAX_SECONDS = 60;

// Chrome/Android record webm, Safari/iOS mp4.
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export const voiceSupported = () =>
  typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

export default function VoiceButton({ disabled, onText, onError }) {
  const [state, setState] = useState("idle"); // idle | recording | working
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);

  // Leaving the page mid-recording: stop the mic.
  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    clearInterval(timerRef.current);
    recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    onError?.(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError?.("I can't reach the microphone. Please allow it in your browser, or type instead.");
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      stopTracks();
      const blob = new Blob(chunks, { type: (recorder.mimeType || "audio/webm").split(";")[0] });
      if (blob.size < 1000) {
        setState("idle");
        onError?.("That was too short to hear. Hold on a little longer and try again.");
        return;
      }
      setState("working");
      try {
        const text = await transcribeAudio(blob);
        if (text) onText(text);
        else onError?.("I couldn't hear any words. Please try again.");
      } catch (err) {
        onError?.(err.message);
      } finally {
        setState("idle");
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) recorder.state === "recording" && recorder.stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  const recording = state === "recording";
  const working = state === "working";
  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={(disabled && !recording) || working}
      aria-label={recording ? "Stop recording" : working ? "Turning your voice into text" : "Speak instead of typing"}
      title={recording ? "Tap to stop" : "Speak instead of typing"}
      className={`relative flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-40 ${
        recording
          ? "border-red-200 bg-red-50 px-3 text-red-600"
          : "w-11 border-slate-200 bg-white text-blue-700 hover:bg-blue-50"
      }`}
    >
      {recording && <span className="absolute -inset-0.5 animate-ping rounded-full border-2 border-red-300 opacity-60" aria-hidden="true" />}
      {working ? (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : recording ? (
        <>
          <span className="h-3 w-3 rounded-sm bg-red-600" aria-hidden="true" />
          <span className="tabular-nums">0:{String(seconds).padStart(2, "0")}</span>
        </>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      )}
    </button>
  );
}
