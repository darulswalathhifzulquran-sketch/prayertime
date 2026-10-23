import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const fmt = (ms: number) => {
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, c = Math.floor(ms % 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(3, "0")}`;
};

export function Stopwatch({ title }: { title: string }) {
  // Elapsed = accumulated + (now - startedAt), using performance.now() so tab inactivity doesn't drift.
  const [acc, setAcc] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [laps, setLaps] = useState<number[]>([]);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (startedAt === null) return;
    const loop = () => { tick((x) => x + 1); raf.current = requestAnimationFrame(loop); };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);
  const elapsed = acc + (startedAt !== null ? performance.now() - startedAt : 0);
  const running = startedAt !== null;
  return (
    <div className="glass-shell glass-tool-panel rounded-3xl p-6">
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <div role="img" aria-label="Photograph of an ornate mosque interior" className="glass-tool-photo glass-timer-photo mt-3" />
      <div className="my-6 text-center font-mono text-4xl tabular-nums sm:text-5xl">{fmt(elapsed)}</div>
      <div className="flex flex-wrap justify-center gap-2">
        {!running ? (
          <Button onClick={() => setStartedAt(performance.now())}>{acc ? "Resume" : "Start"}</Button>
        ) : (
          <Button variant="secondary" onClick={() => { setAcc(elapsed); setStartedAt(null); }}>Pause</Button>
        )}
        <Button variant="outline" disabled={!running} onClick={() => setLaps((l) => [elapsed, ...l])}>Lap</Button>
        <Button variant="outline" onClick={() => { setAcc(0); setStartedAt(null); setLaps([]); }}>Reset</Button>
      </div>
      {laps.length > 0 && (
        <ol className="mt-4 max-h-40 space-y-1 overflow-auto text-sm">
          {laps.map((l, i) => (
            <li key={i} className="flex justify-between border-b py-1 font-mono tabular-nums">
              <span className="text-muted-foreground">Lap {laps.length - i}</span><span>{fmt(l)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
