import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, LoaderCircle, Pause, Play, RotateCcw, Square, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { FIVE, istDateKey, istSecondsOfDay, toMinutes, type PrayerKey, type Timings } from "@/lib/prayer";
import { usePersisted } from "@/hooks/use-prayer-times";
import { tr, type Lang } from "@/lib/i18n";
import { signalReminderChanged } from "@/lib/prayer-feedback";

/** Same uploaded recording, served through two independent public mirrors
 * when the site's static asset cannot be loaded. No third-party Azan substituted. */
const AUDIO_BACKUPS = [
  "https://raw.githubusercontent.com/darulswalathhifzulquran-sketch/prayertime/main/screenshot-match-main/public/audio/al-hafiz-muhammed-noufal.mp3",
  "https://cdn.jsdelivr.net/gh/darulswalathhifzulquran-sketch/prayertime@main/screenshot-match-main/public/audio/al-hafiz-muhammed-noufal.mp3",
] as const;
export function AzanPlayer({ title, now, timings, standardSrc, fajrSrc, view = "player", lang }: {
  title: string; now: Date | null; timings?: Timings | undefined; standardSrc?: string | undefined; fajrSrc?: string | undefined;
  view?: "player" | "reminders"; lang: Lang;
}) {
  const t = tr(lang);
  const audio = useRef<HTMLAudioElement | null>(null);
  const backupIndex = useRef(0);
  const userRequestedPlay = useRef(false);
  const retryPlaybackAfterFallback = useRef(false);
  const [currentSrc, setCurrentSrc] = useState(standardSrc ?? "");
  const [recordingReady, setRecordingReady] = useState(false);
  const [recordingFailed, setRecordingFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = usePersisted("kpt:vol", 0.8);
  const [muted, setMuted] = usePersisted("kpt:muted", false);
  const [enabled, setEnabled] = usePersisted("kpt:azanOn", false);
  const [toggles, setToggles] = usePersisted<Record<string, boolean>>("kpt:toggles", { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true });
  const [unlocked, setUnlocked] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (audio.current) { audio.current.volume = volume; audio.current.muted = muted; } }, [volume, muted]);

  // Reset the media source if an administrator changes the recording.
  useEffect(() => {
    backupIndex.current = 0;
    userRequestedPlay.current = false;
    retryPlaybackAfterFallback.current = false;
    setCurrentSrc(standardSrc ?? "");
    setRecordingReady(false);
    setRecordingFailed(false);
    setLoading(false);
    setMsg("");
  }, [standardSrc]);

  const tryMirror = () => {
    if (!standardSrc || backupIndex.current >= AUDIO_BACKUPS.length) return false;
    const next = AUDIO_BACKUPS[backupIndex.current]!;
    backupIndex.current += 1;
    retryPlaybackAfterFallback.current = userRequestedPlay.current;
    setRecordingReady(false);
    setRecordingFailed(false);
    setLoading(true);
    setMsg("");
    setCurrentSrc(next);
    return true;
  };

  const handleReady = () => {
    setLoading(false);
    setRecordingReady(true);
    setRecordingFailed(false);
    if (!retryPlaybackAfterFallback.current) return;
    retryPlaybackAfterFallback.current = false;
    const a = audio.current;
    if (!a || !userRequestedPlay.current) return;
    void a.play().then(() => { setPlaying(true); setMsg(""); }).catch(() => {
      userRequestedPlay.current = false;
      setMsg(t("playError"));
    });
  };

  const handleAudioError = () => {
    setPlaying(false);
    if (tryMirror()) return;
    retryPlaybackAfterFallback.current = false;
    userRequestedPlay.current = false;
    setRecordingReady(false);
    setRecordingFailed(true);
    setLoading(false);
    setMsg(t("audioUnavailable"));
  };

  const retryRecording = () => {
    backupIndex.current = 0;
    retryPlaybackAfterFallback.current = false;
    userRequestedPlay.current = false;
    setRecordingReady(false);
    setRecordingFailed(false);
    setLoading(false);
    setPlaying(false);
    setMsg("");
    // Retry starts fresh; the Play button remains active even before preload.
    setCurrentSrc(standardSrc ?? "");
  };

  // Browsers (especially mobile and data-saver modes) often skip media preload.
  // Never wait forever for onCanPlay. Load on click and fail over after a stall.
  useEffect(() => {
    if (!standardSrc || !currentSrc || !loading || recordingReady || recordingFailed) return;
    const timeout = window.setTimeout(() => {
      if (audio.current && audio.current.readyState >= HTMLMediaElement.HAVE_METADATA) {
        handleReady();
      } else if (!tryMirror()) {
        retryPlaybackAfterFallback.current = false;
        userRequestedPlay.current = false;
        setLoading(false);
        setRecordingFailed(true);
        setMsg(t("audioUnavailable"));
      }
    }, 9000);
    return () => window.clearTimeout(timeout);
  }, [standardSrc, currentSrc, loading, recordingReady, recordingFailed, lang]);

  const play = async (src?: string) => {
    const a = audio.current;
    if (!a || !src || recordingFailed) return;
    const effectiveSrc = src === standardSrc ? currentSrc : src;
    if (a.getAttribute("src") !== effectiveSrc) a.src = effectiveSrc;
    userRequestedPlay.current = true;
    setLoading(true);
    setMsg("");
    try {
      await a.play();
      setLoading(false);
      setRecordingReady(true);
      setMsg("");
      setPlaying(true);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      if (error instanceof Error && error.name === "NotAllowedError") {
        userRequestedPlay.current = false;
        setLoading(false);
        setMsg(t("playError"));
        return;
      }
      if (tryMirror()) return;
      userRequestedPlay.current = false;
      retryPlaybackAfterFallback.current = false;
      setLoading(false);
      setRecordingFailed(true);
      setMsg(t("audioUnavailable"));
    }
  };

  const enable = async () => {
    signalReminderChanged();
    setEnabled(true);
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    const a = audio.current;
    if (a && standardSrc && recordingReady) {
      a.src = currentSrc; a.muted = true;
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
    <div className="glass-shell glass-tool-panel awqaat-azan-panel rounded-3xl p-6" data-view={view}>
      <audio
        ref={audio}
        src={currentSrc || undefined}
        onLoadedMetadata={handleReady}
        onCanPlay={handleReady}
        onEnded={() => { userRequestedPlay.current = false; setPlaying(false); }}
        onPause={() => { if (!retryPlaybackAfterFallback.current) userRequestedPlay.current = false; setPlaying(false); }}
        onError={handleAudioError}
        preload="none"
        aria-label="Azan recitation by AL HAFIZ MUHAMMED NOUFAL"
      />
      <h3 className="font-display text-2xl font-semibold" dir="auto">{title}</h3>
      <video aria-label="Islamic minaret with moving clouds animation" className="glass-tool-photo mt-3 w-full bg-black object-contain" src="/videos/azan-minaret-animation.mp4" autoPlay muted loop playsInline preload="metadata" />
      {view === "player" && hasAudio && (
        <div className="glass-inner mt-3 flex items-center gap-3 rounded-2xl px-4 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-fuchsia-200/40 bg-white/10" aria-hidden="true">
            <Volume2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{t("record")}</p>
            <p className="awqaat-recording-name text-sm font-extrabold tracking-wide" dir="ltr">AL HAFIZ MUHAMMED NOUFAL</p>
          </div>
        </div>
      )}
      {!hasAudio && view === "player" && (
        <p className="glass-inner mt-2 rounded-xl p-3 text-sm text-muted-foreground">
          {t("noRecording")}
        </p>
      )}
      {hasAudio && view === "player" && !recordingReady && !recordingFailed && (
        <p className="mt-2 flex items-center gap-2 text-xs text-fuchsia-100/85" role="status" aria-live="polite">
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          {loading ? t("audioLoading") : t("audioTapToPlay")}
        </p>
      )}
      <div className={view === "player" ? "awqaat-azan-controls mt-4 flex flex-wrap items-center gap-2" : "hidden"}>
        <Button size="icon" disabled={!hasAudio || recordingFailed} onClick={() => (playing ? (userRequestedPlay.current = false, audio.current?.pause()) : play(standardSrc))} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon" variant="outline" disabled={!hasAudio || !recordingReady || recordingFailed} aria-label="Stop" onClick={() => { userRequestedPlay.current = false; const a = audio.current; if (a) { a.pause(); a.currentTime = 0; } }}><Square /></Button>
        <Button size="icon" variant="outline" disabled={!hasAudio || !recordingReady || recordingFailed} aria-label="Replay" onClick={() => { if (audio.current) audio.current.currentTime = 0; void play(standardSrc); }}><RotateCcw /></Button>
        <Button size="icon" variant="ghost" aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX /> : <Volume2 />}</Button>
        <Slider className="awqaat-azan-volume w-32 self-center" value={[volume * 100]} max={100} onValueChange={(v) => setVolume((v[0] ?? 0) / 100)} aria-label="Volume" />
      </div>
      {view === "reminders" && (
      <div className="glass-inner mt-5 flex items-center justify-between gap-3 rounded-2xl p-3">
        <div className="flex items-center gap-2 text-sm font-medium">{enabled ? <Bell className="h-4 w-4 text-gold" /> : <BellOff className="h-4 w-4" />} {t("azanReminders")}</div>
        {enabled && unlocked ? (
          <Button
            size="sm"
            variant="outline"
            className="reminder-turnoff-button rounded-full border-fuchsia-200/80 bg-fuchsia-100 px-4 font-semibold text-purple-950 shadow-sm hover:bg-white hover:text-purple-950 focus-visible:ring-fuchsia-300"
            onClick={() => { signalReminderChanged(); setEnabled(false); setUnlocked(false); }}
          >{t("turnOff")}</Button>
        ) : (
          <Button size="sm" onClick={enable}>{standardSrc ? t("enableAzan") : t("enableReminder")}</Button>
        )}
      </div>
      )}
      <div className={view === "reminders" ? "mt-3 flex flex-col gap-2" : "hidden"}>
        {FIVE.map((k) => (
          <label key={k} className="glass-inner flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm">
            {k}<Switch checked={!!toggles[k]} onCheckedChange={(c) => { signalReminderChanged(); setToggles({ ...toggles, [k]: c }); }} />
          </label>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-destructive" role="alert">{msg}</p>}
      {recordingFailed && view === "player" && (
        <Button variant="outline" size="sm" className="mt-2 rounded-full" onClick={retryRecording}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t("retry")}
        </Button>
      )}
    </div>
  );
}
