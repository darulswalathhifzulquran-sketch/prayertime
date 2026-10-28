import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, BookOpen, Check, ChevronsUpDown, Home, LocateFixed, Moon, RefreshCw, Settings, Sun, Sunrise, Timer, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Clock } from "@/components/prayer/Clock";
import { Stopwatch } from "@/components/prayer/Stopwatch";
import { AzanPlayer } from "@/components/prayer/AzanPlayer";
import { useNow, usePersisted, usePrayerTimes } from "@/hooks/use-prayer-times";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { CARDS, DEFAULT_METHOD, DISTRICTS, METHODS, TZ, formatHMS, formatTime, istSecondsOfDay, nextPrayer } from "@/lib/prayer";
import { tr, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kerala Prayer Times — All 14 Districts" },
      { name: "description", content: "Live Fajr, Dhuhr, Asr, Maghrib, Isha and Sunrise times for every Kerala district, with countdown, Azan reminders and stopwatch." },
      { property: "og:title", content: "Kerala Prayer Times — All 14 Districts" },
      { property: "og:description", content: "Daily prayer times for all 14 Kerala districts in English, Arabic and Malayalam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [districtId, setDistrictId] = usePersisted("kpt:district", "tvm");
  const [method, setMethod] = usePersisted("kpt:method", DEFAULT_METHOD);
  const [h12, setH12] = usePersisted("kpt:h12", true);
  const [clockMode, setClockMode] = usePersisted<"digital" | "analog">("kpt:clock", "digital");
  const [theme, setTheme] = usePersisted<"light" | "dark">("kpt:theme", "light");
  const [lang, setLang] = usePersisted<Lang>("kpt:lang", "en");
  const t = tr(lang);
  const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0];
  const gps = useDeviceLocation();
  // Round only for prayer-time lookup: ~11 m resolution, enough for minute-level calculations.
  // Browser-supplied GPS coordinates are never written to localStorage.
  const gpsLat = gps.location ? Number(gps.location.latitude.toFixed(4)) : null;
  const gpsLng = gps.location ? Number(gps.location.longitude.toFixed(4)) : null;
  const prayerLocation = useMemo(
    () => gpsLat !== null && gpsLng !== null
      ? { id: "gps", lat: gpsLat, lng: gpsLng }
      : district,
    [district, gpsLat, gpsLng],
  );
  const pt = usePrayerTimes(prayerLocation, method);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  // Always show the live timing for the selected district or GPS coordinates.
  // Past locally-entered reference times never override another location or date.
  const displayedTimings = pt.today;
  const tomorrowFajr = pt.tomorrowFajr;

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);

  const next = now && displayedTimings ? nextPrayer(displayedTimings, istSecondsOfDay(now), tomorrowFajr) : null;
  const methodName = METHODS.find((m) => m.id === method)?.name ?? `Method ${method}`;

  const chooseDistrict = (id: string) => {
    gps.disable();
    setDistrictId(id);
    setOpen(false);
  };

  const jumpTo = (id: string) => {
    if (id === "settings") {
      setSettingsOpen((open) => !open);
      return;
    }
    // Home and Prayer share the same page; the other tabs have dedicated content.
    setActiveTab(id);
    // Wait for the selected tab to become visible before scrolling.
    requestAnimationFrame(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (id === "prayers") {
        document.getElementById("prayers")?.scrollIntoView({ behavior, block: "start" });
      } else {
        window.scrollTo({ top: 0, behavior });
      }
    });
  };

  const navigation = [
    { id: "home", name: "Home", icon: Home },
    { id: "prayers", name: "Prayer", icon: BookOpen },
    { id: "azan", name: "Azan", icon: Volume2 },
    { id: "reminder", name: "Reminder", icon: Bell },
    { id: "stopwatch", name: "Timer", icon: Timer },
    { id: "settings", name: "Settings", icon: Settings },
  ] as const;
  // The Settings sheet is an overlay. Its tab temporarily takes the active
  // indicator, which returns to the current page when the sheet closes.
  const activeNavIndex = settingsOpen
    ? navigation.length - 1
    : navigation.findIndex((item) => item.id === activeTab);
  const showHome = activeTab === "home" || activeTab === "prayers";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background pb-28 dark:from-emerald-950/20 dark:via-background dark:to-background">
      <header className="sticky top-0 z-20 border-b border-white/30 bg-background/70 shadow-sm backdrop-blur-xl dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero font-arabic text-lg text-gold">۞</span>
            <span className="font-display text-2xl font-semibold">{t("title")}</span>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-56 justify-between" aria-label={t("district")}>
                {gps.location
                  ? (lang === "ml" ? "നിലവിലെ GPS സ്ഥാനം" : "Current GPS location")
                  : lang === "ml" ? district.ml : district.en}
                <ChevronsUpDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder={t("search")} />
                <CommandList>
                  <CommandEmpty>—</CommandEmpty>
                  <CommandGroup>
                    {DISTRICTS.map((d) => (
                      <CommandItem key={d.id} value={`${d.en} ${d.ml}`} onSelect={() => chooseDistrict(d.id)}>
                        <Check className={cn("h-4 w-4", d.id === district.id ? "opacity-100" : "opacity-0")} />
                        {d.en} <span className="ml-auto font-ml text-xs text-muted-foreground">{d.ml}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button
            variant={gps.enabled ? "secondary" : "ghost"}
            size="icon"
            onClick={gps.toggle}
            aria-label={gps.enabled ? "Turn off GPS location" : "Use my current GPS location"}
            title={gps.enabled ? "Turn off GPS location" : "Use current GPS location for prayer times"}
            aria-pressed={gps.enabled}
            className={gps.enabled ? "text-primary" : undefined}
          ><LocateFixed className={gps.locating ? "animate-pulse" : undefined} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Theme">{theme === "dark" ? <Sun /> : <Moon />}</Button>
          <Sheet modal={false} open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={t("settings")}><Settings /></Button></SheetTrigger>
            <SheetContent
              onInteractOutside={(event) => {
                const target = event.target;
                if (target instanceof Element && target.closest('[data-bottom-settings-button="true"]')) {
                  event.preventDefault();
                }
              }}
            >
              <SheetHeader><SheetTitle>{t("settings")}</SheetTitle></SheetHeader>
              <div className="space-y-5 p-4 text-sm">
                <Field label="Interface language">
                  <ToggleGroup type="single" value={lang} onValueChange={(v) => v && setLang(v as Lang)}>
                    <ToggleGroupItem value="en">English</ToggleGroupItem><ToggleGroupItem value="ml">മലയാളം</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label="Calculation method">
                  <Select value={String(method)} onValueChange={(v) => setMethod(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Asr is always Shafi'i (standard shadow).</p>
                </Field>
                <Field label="Time format">
                  <ToggleGroup type="single" value={h12 ? "12" : "24"} onValueChange={(v) => v && setH12(v === "12")}>
                    <ToggleGroupItem value="12">12-hour</ToggleGroupItem><ToggleGroupItem value="24">24-hour</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label="Clock">
                  <ToggleGroup type="single" value={clockMode} onValueChange={(v) => v && setClockMode(v as "digital" | "analog")}>
                    <ToggleGroupItem value="digital">{t("digital")}</ToggleGroupItem><ToggleGroupItem value="analog">{t("analog")}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label="Theme">
                  <ToggleGroup type="single" value={theme} onValueChange={(v) => v && setTheme(v as "light" | "dark")}>
                    <ToggleGroupItem value="light">Light</ToggleGroupItem><ToggleGroupItem value="dark">Dark</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {(gps.locating || gps.error || gps.location) && (
          <p className="pb-2 px-4 text-center text-xs text-muted-foreground" role="status" aria-live="polite">
            {gps.error
              ? gps.error
              : gps.location
                ? `GPS prayer times active · accuracy ±${Math.round(gps.location.accuracy)} m${gps.location.accuracy > 1000 ? " · Location is approximate; improve GPS accuracy for better results." : ""}`
                : "Requesting precise location permission…"}
          </p>
        )}
      </header>

      <main className="violet-premium mx-auto max-w-5xl space-y-6 px-4 py-8">
        <section id="home" className={cn("glassy-hero scroll-mt-24 relative mx-auto max-w-xl overflow-hidden rounded-[2rem] p-6 text-white shadow-soft sm:p-8", !showHome && "hidden")}>
          <div className="islamic-pattern absolute inset-0 opacity-60" aria-hidden />
          <div className="relative flex flex-col items-stretch gap-6">
            <div id="clock" className="scroll-mt-28 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-gold">
                {gps.location
                  ? (lang === "ml" ? "നിങ്ങളുടെ ഇപ്പോഴത്തെ GPS സ്ഥാനം" : "Your current GPS location")
                  : lang === "ml" ? district.ml : district.en}
              </p>
              <p className="mb-6 text-xs opacity-70">
                {gps.location
                  ? `${gps.location.latitude.toFixed(4)}°N, ${gps.location.longitude.toFixed(4)}°E · GPS accuracy ±${Math.round(gps.location.accuracy)} m`
                  : `${district.hq} · ${district.lat.toFixed(4)}°N, ${district.lng.toFixed(4)}°E`}
              </p>
              {now ? <Clock now={now} mode={clockMode} h12={h12} lang={lang} /> : <div className="h-24" />}
            </div>
            <div className="glass-on-dark rounded-3xl border border-white/25 p-5 text-center text-white backdrop-blur-xl">
              <p className="text-sm uppercase tracking-widest text-gold">{t("next")}</p>
              {next ? (
                <>
                  <p className="mt-3 font-arabic text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl" dir="rtl" lang="ar">
                    {CARDS.find((c) => c.key === next.key)?.ar}
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none tracking-wide text-white drop-shadow-sm">{next.key}</p>
                  <p className="mt-5 text-xs uppercase tracking-widest opacity-80">{t("remaining")}{next.tomorrow ? ` · ${t("tomorrow")}` : ""}</p>
                  <p className="font-mono text-5xl font-extrabold tabular-nums">{formatHMS(next.secondsLeft)}</p>
                </>
              ) : (
                <p className="mt-4 opacity-80">{pt.error ?? "Loading…"}</p>
              )}
            </div>
          </div>
        </section>

        <section id="prayers" className={cn("glass-shell scroll-mt-24 mx-auto max-w-xl rounded-[2rem] p-4 sm:p-6", !showHome && "hidden")}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">{t("todays")}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {pt.fetchedAt && <span>{t("updated")}: {new Date(pt.fetchedAt).toLocaleString("en-IN", { timeZone: TZ })}{pt.fromCache ? ` (${t("cached")})` : ""}</span>}
              <Button variant="ghost" size="sm" onClick={pt.reload} disabled={pt.loading}><RefreshCw className={cn("h-3 w-3", pt.loading && "animate-spin")} />{t("retry")}</Button>
            </div>
          </div>
          {pt.error && <p className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{pt.error}</p>}
          <div className="glass-inner mb-4 rounded-xl p-3 text-sm">
            <strong>API-calculated times — NOT verified local mosque times</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              GPS identifies the location; it cannot verify the local mosque timetable.
              Compare with your local masjid's approved calendar before relying on prayer times or Azan reminders.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {CARDS.map((c) => {
              const isNext = next?.key === c.key;
              const sunrise = c.key === "Sunrise";
              return (
                <article key={c.key} data-prayer={c.key} className={cn(
                  "glassy-prayer-row relative flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all",
                  isNext && "glassy-prayer-upcoming ring-2 ring-emerald-400/70",
                  sunrise && "border-dashed border-amber-400/40",
                )}>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-arabic text-2xl font-semibold leading-snug text-primary text-left" dir="rtl" lang="ar">{c.ar}</h3>
                    <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                      <span className="font-ml text-sm font-bold">{c.ml}</span> · {c.en}
                    </p>
                    {sunrise && <p className="mt-1 text-[11px] text-muted-foreground">{t("notPrayer")}</p>}
                    {isNext && <span className="mt-1 inline-block rounded-full border border-fuchsia-200/70 bg-fuchsia-100 px-2.5 py-1 text-[10px] font-semibold text-purple-950 shadow-sm">{t("upcoming")}</span>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {sunrise && <Sunrise className="h-5 w-5 text-amber-500" />}
                    <p className="whitespace-nowrap font-mono text-xl font-bold tabular-nums sm:text-2xl">
                      {displayedTimings ? formatTime(displayedTimings[c.key], h12) : "--:--"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Keep both tools mounted while navigating: audio scheduling and running stopwatch persist. */}
        <section
          id="azan"
          className={cn("mx-auto max-w-xl scroll-mt-24", activeTab !== "azan" && activeTab !== "reminder" && "hidden")}
          aria-label={activeTab === "reminder" ? "Azan reminders" : "Azan player"}
        >
          <AzanPlayer
            title={activeTab === "reminder" ? "Azan Reminders" : t("azan")}
            view={activeTab === "reminder" ? "reminders" : "player"}
            standardSrc="/audio/al-hafiz-muhammed-noufal.mp3"
            now={now}
            timings={displayedTimings}
          />
        </section>
        <section id="stopwatch" className={cn("mx-auto max-w-xl scroll-mt-24", activeTab !== "stopwatch" && "hidden")}>
          <Stopwatch title={t("stopwatch")} />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-xs text-muted-foreground">
          <p>Source: AlAdhan API (api.aladhan.com) · Method: {methodName} · Asr: Shafi'i · Timezone: {TZ}</p>
          {pt.fetchedAt && <p>{t("updated")}: {new Date(pt.fetchedAt).toLocaleString("en-IN", { timeZone: TZ })}</p>}
          <p>{gps.location
            ? "Prayer times are calculated using your browser's GPS coordinates (shared with AlAdhan when requesting timings). GPS has an uncertainty radius and is not guaranteed to be exact. Coordinates are not saved in browser storage."
            : "District times are calculated for each district headquarters. Use the location button for GPS-based timings."}</p>
          <p>These are API-calculated estimates for the selected district or GPS location, not verified local mosque timetable times.</p>
          <p>GPS-based API requests share browser-provided coordinates with AlAdhan, not our backend.</p>
          <p>Architecture photography from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Unsplash</a>.</p>
        </div>
      </footer>
      <nav className="glass-bottom-nav" aria-label="Primary navigation">
        <span
          aria-hidden="true"
          className="glass-nav-indicator"
          style={{ transform: `translate3d(${Math.max(activeNavIndex, 0) * 100}%, 0, 0)` }}
        />
        {navigation.map(({ id, name, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-label={name}
            aria-expanded={id === "settings" ? settingsOpen : undefined}
            data-bottom-settings-button={id === "settings" ? "true" : undefined}
            aria-current={(settingsOpen ? id === "settings" : activeTab === id) ? "page" : undefined}
            onClick={() => jumpTo(id)}
            className={cn("glass-nav-item", (settingsOpen ? id === "settings" : activeTab === id) && "glass-nav-selected")}
          >
            <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
            <span>{name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-2 font-medium">{label}</p>{children}</div>;
}
