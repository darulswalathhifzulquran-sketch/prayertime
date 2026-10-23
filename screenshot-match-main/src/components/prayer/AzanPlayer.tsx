import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Pause, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { FIVE, istDateKey, istSecondsOfDay, toMinutes, type PrayerKey, type Timings } from "@/lib/prayer";
import { usePersisted } from "@/hooks/use-prayer-times";

/** Recorded Azan player. Audio source is the admin-uploaded recording (none until uploaded). */
export function AzanPlayer({ title, now, timings, standardSrc, fajrSrc }: {
  title: string; now: Date | null; timings?: Timings | undefined; standardSrc?: string | undefined; fajrSrc?: string | undefined;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = usePersisted("kpt:vol", 0.8);
  const [muted, setMuted] = usePersisted("kpt:muted", false);
  const [enabled, setEnabled] = usePersisted("kpt:azanOn", false);
  const [toggles, setToggles] = usePersisted<Record<string, boolean>>("kpt:toggles", { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true });
  const [unlocked, setUnlocked] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (audio.current) { audio.current.volume = volume; audio.current.muted = muted; } }, [volume, muted]);

  const play = async (src?: string) => {
    const a = audio.current; if (!a || !src) return;
    if (a.src !== src) a.src = src;
    try { await a.play(); setPlaying(true); } catch { setMsg("The browser blocked sound. Tap Play to hear the Azan."); }
  };

  const enable = async () => {
    setEnabled(true);
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    const a = audio.current;
    if (a && standardSrc) {
      a.src = standardSrc; a.muted = true;
      try { await a.play(); a.pause(); a.currentTime = 0; setUnlocked(true); } catch { /* ignore */ }
      a.muted = muted;
    } else setUnlocked(true);
  };

  // Scheduler: fire once per prayer occurrence (never Sunrise).
  useEffect(() => {
    if (!now || !timings || !enabled) return;
    const sec = istSecondsOfDay(now);
    for (const k of FIVE as PrayerKey[]) {
      if (!toggles[k]) continue;
      const start = toMinutes(timings[k]) * 60;
      if (sec >= start && sec < start + 60) {
        const id = `kpt:fired:${istDateKey(now)}:${k}`;
        if (localStorage.getItem(id)) continue;
        localStorage.setItem(id, "1");
        if ("Notification" in window && Notification.permission === "granted") new Notification(`${k} — time for prayer`);
        if (unlocked) void play(k === "Fajr" && fajrSrc ? fajrSrc : standardSrc);
      }
    }
  }, [now, timings, enabled, toggles, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasAudio = !!standardSrc;
  return (
    <div className="glass-shell glass-tool-panel rounded-3xl p-6">
      <audio ref={audio} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} preload="none" />
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <div role="img" aria-label="Photograph of a mosque minaret" className="glass-tool-photo glass-azan-photo mt-3" />
      {!hasAudio && (
        <p className="glass-inner mt-2 rounded-xl p-3 text-sm text-muted-foreground">
          No Azan recording has been uploaded yet. Reminders will still show a notification.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="icon" disabled={!hasAudio} onClick={() => (playing ? audio.current?.pause() : play(standardSrc))} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="outline" disabled={!hasAudio} aria-label="Stop" onClick={() => { const a = audio.current; if (a) { a.pause(); a.currentTime = 0; } }}><Square /></Button>
        <Button size="icon" variant="outline" disabled={!hasAudio} aria-label="Replay" onClick={() => { if (audio.current) audio.current.currentTime = 0; void play(standardSrc); }}><RotateCcw /></Button>
        <Button size="icon" variant="ghost" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX /> : <Volume2 />}</Button>
        <Slider className="w-32 self-center" value={[volume * 100]} max={100} onValueChange={(v) => setVolume((v[0] ?? 0) / 100)} aria-label="Volume" />
      </div>
      <div className="glass-inner mt-5 flex items-center justify-between gap-3 rounded-2xl p-3">
        <div className="flex items-center gap-2 text-sm font-medium">{enabled ? <Bell className="h-4 w-4 text-gold" /> : <BellOff className="h-4 w-4" />} Azan reminders</div>
        {enabled && unlocked ? (
          <Button size="sm" variant="outline" onClick={() => { setEnabled(false); setUnlocked(false); }}>Turn off</Button>
        ) : (
          <Button size="sm" onClick={enable}>Enable Azan Audio</Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FIVE.map((k) => (
          <label key={k} className="glass-inner flex items-center justify-between rounded-xl px-3 py-2 text-sm">
            {k}<Switch checked={!!toggles[k]} onCheckedChange={(c) => setToggles({ ...toggles, [k]: c })} />
          </label>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-destructive">{msg}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        Sound plays only while this page is open and after you tap "Enable Azan Audio". It may not play if the browser is closed, the phone is locked, or the browser blocks autoplay. No Azan plays at Sunrise.
      </p>
    </div>
  );
}
