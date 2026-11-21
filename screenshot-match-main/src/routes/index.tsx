import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, Check, ChevronsUpDown, Compass, Home, LocateFixed, Moon, RefreshCw, Settings, Sun, Sunrise, Timer, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDIA_STATES, DEFAULT_STATE_ID, type IndiaDistrict } from "@/lib/india-locations";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Clock } from "@/components/prayer/Clock";
import { Stopwatch } from "@/components/prayer/Stopwatch";
import { QiblaCompass } from "@/components/prayer/QiblaCompass";
import { AzanPlayer } from "@/components/prayer/AzanPlayer";
import { useNow, usePersisted, usePrayerTimes } from "@/hooks/use-prayer-times";
import { useDeviceLocation } from "@/hooks/use-device-location";
import { CARDS, DEFAULT_METHOD, METHODS, TZ, formatHMS, formatTime, istDateKey, istSecondsOfDay, nextPrayer, type AsrSchool, type PrayerLocation } from "@/lib/prayer";
import { tr, localizeDigits, type Lang } from "@/lib/i18n";
import { prayerDueThisMinute, signalPrayerTime, unlockPrayerBeep } from "@/lib/prayer-feedback";
import { cn } from "@/lib/utils";

// State/UT names stay A–Z. Kerala's districts follow the requested
// geographic south-to-north map order; other districts remain A–Z.
// Sorting only copies for display and never changes source IDs, GPS,
// prayer-time coordinates or persisted user selection.
const LOCATION_ORDER = new Intl.Collator("en", { sensitivity: "base", numeric: true, ignorePunctuation: true });
const KERALA_SOUTH_TO_NORTH = [
  "tvm", "klm", "pta", "alp", "ktm", "idk", "ekm",
  "tsr", "pkd", "mlp", "kkd", "wyd", "knr", "ksd",
] as const;
const KERALA_RANK = new Map<string, number>(
  KERALA_SOUTH_TO_NORTH.map((id, index) => [id, index]),
);
const orderDistricts = (state: { id: string; districts: IndiaDistrict[] }): IndiaDistrict[] =>
  [...state.districts].sort((a, b) =>
    state.id === DEFAULT_STATE_ID
      ? (KERALA_RANK.get(a.id) ?? 99) - (KERALA_RANK.get(b.id) ?? 99) ||
        LOCATION_ORDER.compare(a.name, b.name)
      : LOCATION_ORDER.compare(a.name, b.name),
  );
const ORDERED_STATES = [...INDIA_STATES].sort((a, b) => LOCATION_ORDER.compare(a.name, b.name));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JAMIA AWQAAT — Islamic Prayer Times Across India" },
      { name: "description", content: "JAMIA AWQAAT (also known as AWQAAT): calculated Fajr, Dhuhr, Asr, Maghrib, Isha and Sunrise prayer times across India, with GPS, district selection, Azan reminders and stopwatch." },
      { property: "og:title", content: "JAMIA AWQAAT — Islamic Prayer Times Across India" },
      { property: "og:description", content: "Calculated prayer times throughout India in English, Arabic and Malayalam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [stateId, setStateId] = usePersisted("kpt:state", DEFAULT_STATE_ID);
  // Retain the old Kerala district IDs and existing user preference.
  const [districtId, setDistrictId] = usePersisted("kpt:district", "tvm");
  const [city, setCity] = useState("");
  const [cityDraft, setCityDraft] = useState("");
  const [districtSearch, setDistrictSearch] = useState("");
  const [method, setMethod] = usePersisted("kpt:method", DEFAULT_METHOD);
  const [school, setSchool] = usePersisted<AsrSchool>("kpt:asrSchool", 0);
  const [h12, setH12] = usePersisted("kpt:h12", true);
  const [clockMode, setClockMode] = usePersisted<"digital" | "analog">("kpt:clock", "digital");
  const [theme, setTheme] = usePersisted<"light" | "dark">("kpt:theme", "light");
  const [lang, setLang] = usePersisted<Lang>("kpt:lang", "en");
  const t = tr(lang);
  const state = ORDERED_STATES.find((s) => s.id === stateId) ?? ORDERED_STATES.find((s) => s.id === DEFAULT_STATE_ID)!;
  const district = state.districts.find((d) => d.id === districtId) ?? state.districts[0]!;
  // Kerala retains Malayalam district names. Across India, never translate
  // district names into Arabic (as requested for the current AWQAAT selector).
  const districtLabel = (d: IndiaDistrict) => lang === "ml" && d.ml ? d.ml : d.name;
  const orderedDistricts = useMemo(() => orderDistricts(state), [state]);
  const visibleDistricts = useMemo(() => {
    const search = districtSearch.trim().toLocaleLowerCase("en");
    if (!search) return orderedDistricts;
    return orderedDistricts.filter((district) =>
      `${district.name} ${district.ml ?? ""}`.toLocaleLowerCase("en").includes(search),
    );
  }, [districtSearch, orderedDistricts]);
  const locationLabel = city ? `${city}, ${districtLabel(district)}` : districtLabel(district);
  const gps = useDeviceLocation();
  // Round only for prayer-time lookup: ~11 m resolution, enough for minute-level calculations.
  // Browser-supplied GPS coordinates are never written to localStorage.
  const gpsLat = gps.location ? Number(gps.location.latitude.toFixed(4)) : null;
  const gpsLng = gps.location ? Number(gps.location.longitude.toFixed(4)) : null;
  const prayerLocation = useMemo<PrayerLocation>(() => {
    if (gpsLat !== null && gpsLng !== null) return { id: "gps", lat: gpsLat, lng: gpsLng };
    // Optional town is resolved by qualified district/state address; no coords
    // or prayer schedule are invented for it.
    if (city) return {
      id: `city:${state.id}:${district.id}:${city.toLowerCase()}`,
      address: `${city}, ${district.name}, ${state.name}, India`,
    };
    if (district.lat !== undefined && district.lng !== undefined) {
      return { id: district.id, lat: district.lat, lng: district.lng };
    }
    return { id: district.id, address: `${district.name}, ${state.name}, India` };
  }, [gpsLat, gpsLng, state.id, state.name, district, city]);
  const pt = usePrayerTimes(prayerLocation, method, school);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  // Always show the live timing for the selected district or GPS coordinates.
  // Past locally-entered reference times never override another location or date.
  const displayedTimings = pt.today;
  const tomorrowFajr = pt.tomorrowFajr;
  // Read-only GPS/location metadata: preserve GPS watch and selection behavior.
  const shownPosition = gps.location
    ? { lat: gps.location.latitude, lng: gps.location.longitude }
    : city
      ? pt.resolvedCoordinates
      : district.lat !== undefined && district.lng !== undefined
        ? { lat: district.lat, lng: district.lng }
        : pt.resolvedCoordinates;
  const lastFeedbackRef = useRef<string | null>(null);

  // A browser permits audible feedback after the user has interacted with the
  // installed web app. No new preference, switch or notification prompt needed.
  useEffect(() => {
    const arm = () => unlockPrayerBeep();
    document.addEventListener("pointerdown", arm, { passive: true });
    document.addEventListener("keydown", arm);
    return () => {
      document.removeEventListener("pointerdown", arm);
      document.removeEventListener("keydown", arm);
    };
  }, []);

  // Automatic signal at each of the five prayers, independent of Azan playback
  // and reminder switches. Once per prayer and IST date across page reloads.
  // Only runs while this web app has an active JavaScript page context.
  useEffect(() => {
    if (!now || !displayedTimings || pt.dateKey !== istDateKey(now)) return;
    const prayer = prayerDueThisMinute(now, displayedTimings);
    if (!prayer) return;
    const firedKey = `kpt:prayer-feedback:${istDateKey(now)}:${prayer}`;
    if (lastFeedbackRef.current === firedKey) return;
    lastFeedbackRef.current = firedKey;
    try {
      if (window.localStorage.getItem(firedKey)) return;
      window.localStorage.setItem(firedKey, "1");
    } catch {
      // Feedback still runs once per page session if storage is unavailable.
    }
    signalPrayerTime();
  }, [now, displayedTimings, pt.dateKey]);

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const next = now && displayedTimings ? nextPrayer(displayedTimings, istSecondsOfDay(now), tomorrowFajr) : null;
  const methodName = METHODS.find((m) => m.id === method)?.name ?? `Method ${method}`;

  const chooseState = (id: string) => {
    const nextState = ORDERED_STATES.find((s) => s.id === id);
    if (!nextState?.districts.length) return;
    gps.disable();
    setStateId(nextState.id);
    setDistrictId(orderDistricts(nextState)[0]!.id);
    setCity("");
    setCityDraft("");
    setDistrictSearch("");
  };
  const chooseDistrict = (id: string) => {
    gps.disable();
    setDistrictId(id);
    setCity("");
    setCityDraft("");
    setDistrictSearch("");
    setOpen(false);
  };
  const applyCity = () => {
    const town = cityDraft.trim();
    if (!town) return;
    gps.disable();
    setCity(town);
    setOpen(false);
  };

  const jumpTo = (id: string) => {
    if (id === "settings") {
      setSettingsOpen((open) => !open);
      return;
    }
    // Home and Prayer share the same page; the other tabs have dedicated content.
    setOpen(false);
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
    { id: "home", name: t("navHome"), icon: Home },
    { id: "prayers", name: t("navPrayer"), icon: BookOpen },
    { id: "qibla", name: t("navQibla"), icon: Compass },
    { id: "azan", name: t("navAzan"), icon: Volume2 },
    { id: "reminder", name: t("navReminder"), icon: Bell },
    { id: "stopwatch", name: t("navTimer"), icon: Timer },
    { id: "settings", name: t("settings"), icon: Settings },
  ] as const;
  // The Settings sheet is an overlay. Its tab temporarily takes the active
  // indicator, which returns to the current page when the sheet closes.
  const activeNavIndex = settingsOpen
    ? navigation.length - 1
    : navigation.findIndex((item) => item.id === activeTab);
  const showHome = activeTab === "home" || activeTab === "prayers";
  // Never substitute a district's coordinates for a manually entered city.
  // City and address-only districts use the API's verified-in-India coordinates.
  const qiblaPosition = gps.location
    ? { lat: gps.location.latitude, lng: gps.location.longitude, source: "gps" as const }
    : city
      ? pt.resolvedCoordinates
        ? { lat: pt.resolvedCoordinates.lat, lng: pt.resolvedCoordinates.lng, source: "address" as const }
        : null
      : district.lat !== undefined && district.lng !== undefined
        ? { lat: district.lat, lng: district.lng, source: "district" as const }
        : pt.resolvedCoordinates
          ? { lat: pt.resolvedCoordinates.lat, lng: pt.resolvedCoordinates.lng, source: "address" as const }
          : null;

  return (
    <div className={cn("awqaat-app min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background pb-28 dark:from-emerald-950/20 dark:via-background dark:to-background", lang === "ar" && "awqaat-arabic-numerals")}>
      <header className="awqaat-topbar sticky top-0 z-20 border-b border-white/30 bg-background/70 shadow-sm backdrop-blur-xl dark:border-white/10">
        <div className="awqaat-header-layout mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="awqaat-header-brand flex min-w-0 items-center gap-2">
            <span className="awqaat-brand-emblem grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-hero font-arabic text-lg text-gold">۞</span>
            <span className="brand-awqaat">{t("title")}</span>
          </div>
          <div className="awqaat-header-actions">
            {showHome && (
            <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setDistrictSearch(""); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="awqaat-location-trigger w-56 max-w-full justify-between gap-2" aria-label={t("district")}>
                <span className="min-w-0 truncate text-left" dir="auto">
                  {gps.location ? t("gpsCurrent") : `${state.name} · ${locationLabel}`}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="awqaat-location-menu w-[min(92vw,380px)] max-h-[min(78dvh,680px)] overflow-y-auto overscroll-contain p-3" align="end">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                <LocateFixed className="h-4 w-4" />
                {t("chooseLocation")}
              </div>
              <div className="mb-3 space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">{t("state")}</label>
                <Select value={state.id} onValueChange={chooseState}>
                  <SelectTrigger className="w-full rounded-xl bg-background/80">
                    <SelectValue placeholder={t("state")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ORDERED_STATES.map((s) =>
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="mb-3 space-y-1.5">
                <label className="flex items-center justify-between text-xs font-bold text-muted-foreground"><span>{t("district")}</span><span className="font-semibold tracking-[0.1em] text-emerald-700/80 dark:text-emerald-200/80">{state.id === DEFAULT_STATE_ID ? "South → North" : "A–Z"}</span></label>
                <Command shouldFilter={false} className="overflow-hidden rounded-xl border bg-background/70">
                  <CommandInput
                    value={districtSearch}
                    onValueChange={setDistrictSearch}
                    placeholder={lang === "ar" ? "Search district…" : t("search")}
                  />
                  <CommandList className="max-h-48">
                    {visibleDistricts.length === 0 ? (
                      <div role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noDistrict")}</div>
                    ) : (
                      <CommandGroup>
                        {visibleDistricts.map((d) => (
                          <CommandItem key={d.id} value={`${d.name} ${d.ml ?? ""}`} onSelect={() => chooseDistrict(d.id)}>
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", d.id === district.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{districtLabel(d)}</span>
                            {d.ml && lang !== "ml" &&
                              <span className="ml-auto pl-2 font-ml text-xs text-muted-foreground">{d.ml}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">{t("cityOptional")}</label>
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border bg-background/80 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    value={cityDraft}
                    onChange={(event) => setCityDraft(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") applyCity(); }}
                    placeholder={t("cityPlaceholder")}
                    aria-label={t("cityOptional")}
                    maxLength={80}
                  />
                  <Button size="sm" className="rounded-xl" disabled={!cityDraft.trim()} onClick={applyCity}>
                    {t("applyCity")}
                  </Button>
                </div>
                {city && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => { setCity(""); setCityDraft(""); }}>
                    {t("clearCity")}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{t("locationHelp")}</p>
              {shownPosition && (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3" role="status">
                  <p className="text-[11px] font-semibold tracking-wide text-emerald-700 dark:text-emerald-200" dir="auto">
                    {gps.location ? t("geoLive") : t("geoReference")}
                  </p>
                  <dl className="mt-2 grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <dt className="text-[10px] text-muted-foreground">{t("geoLatitude")}</dt>
                      <dd className="font-mono text-xs font-semibold tabular-nums" dir="ltr">{Math.abs(shownPosition.lat).toFixed(5)}° {shownPosition.lat >= 0 ? "N" : "S"}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] text-muted-foreground">{t("geoLongitude")}</dt>
                      <dd className="font-mono text-xs font-semibold tabular-nums" dir="ltr">{Math.abs(shownPosition.lng).toFixed(5)}° {shownPosition.lng >= 0 ? "E" : "W"}</dd>
                    </div>
                  </dl>
                  {gps.location && (
                    <p className="mt-2 text-[11px] text-muted-foreground" dir="auto">
                      {t("geoAccuracy")}: ±{Math.round(gps.location.accuracy)} m
                    </p>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
            )}
          <Button
            variant={gps.enabled ? "secondary" : "ghost"}
            size="icon"
            onClick={gps.toggle}
            aria-label={gps.enabled ? t("gpsEnabled") : t("gpsDisabled")}
            title={gps.enabled ? t("gpsEnabled") : t("gpsDisabled")}
            aria-pressed={gps.enabled}
            className={gps.enabled ? "text-primary" : undefined}
          ><LocateFixed className={gps.locating ? "animate-pulse" : undefined} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={t("theme")}>{theme === "dark" ? <Sun /> : <Moon />}</Button>
          <Sheet modal={false} open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={t("settings")}><Settings /></Button></SheetTrigger>
            <SheetContent
              className="awqaat-settings-panel"
              dir={lang === "ar" ? "rtl" : "ltr"}
              onInteractOutside={(event) => {
                const target = event.target;
                if (target instanceof Element && target.closest('[data-bottom-settings-button="true"]')) {
                  event.preventDefault();
                }
              }}
            >
              <SheetHeader><SheetTitle>{t("settings")}</SheetTitle></SheetHeader>
              <div className="space-y-5 p-4 text-sm">
                <Field label={t("interfaceLanguage")}>
                  <ToggleGroup type="single" value={lang} onValueChange={(v) => v && setLang(v as Lang)}>
                    <ToggleGroupItem value="en">English</ToggleGroupItem><ToggleGroupItem value="ml">മലയാളം</ToggleGroupItem><ToggleGroupItem value="ar" className="font-arabic text-base" lang="ar" dir="rtl">العربية</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label={t("calculationMethod")}>
                  <Select value={String(method)} onValueChange={(v) => setMethod(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="awqaat-settings-options">{METHODS.map((m) => <SelectItem key={m.id} value={String(m.id)}>{localizeDigits(m.name, lang)}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">{t("shafiiNote")}</p>
                </Field>
                <Field label={t("asrSchool")}>
                  <ToggleGroup type="single" value={String(school)} onValueChange={(value) => { if (value) setSchool(Number(value) as AsrSchool); }}>
                    <ToggleGroupItem value="0">{t("shafii")}</ToggleGroupItem>
                    <ToggleGroupItem value="1">{t("hanafi")}</ToggleGroupItem>
                  </ToggleGroup>
                  <p className="mt-1 text-xs text-muted-foreground">{t("asrExplanation")}</p>
                </Field>
                <Field label={t("timeFormat")}>
                  <ToggleGroup type="single" value={h12 ? "12" : "24"} onValueChange={(v) => v && setH12(v === "12")}>
                    <ToggleGroupItem value="12">{localizeDigits(t("h12"), lang)}</ToggleGroupItem><ToggleGroupItem value="24">{localizeDigits(t("h24"), lang)}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label={t("clock")}>
                  <ToggleGroup type="single" value={clockMode} onValueChange={(v) => v && setClockMode(v as "digital" | "analog")}>
                    <ToggleGroupItem value="digital">{t("digital")}</ToggleGroupItem><ToggleGroupItem value="analog">{t("analog")}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
                <Field label={t("theme")}>
                  <ToggleGroup type="single" value={theme} onValueChange={(v) => v && setTheme(v as "light" | "dark")}>
                    <ToggleGroupItem value="light">{t("light")}</ToggleGroupItem><ToggleGroupItem value="dark">{t("dark")}</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>
        {(gps.locating || gps.error || gps.location) && (
          <p className="pb-2 px-4 text-center text-xs text-muted-foreground" role="status" aria-live="polite" dir="auto">
            {gps.error
              ? localizeDigits(gps.error, lang)
              : gps.location
                ? localizeDigits(`${t("gpsActive")} · ${t("gpsAccuracy")} ±${Math.round(gps.location.accuracy)} m${gps.location.accuracy > 1000 ? ` · ${t("gpsApprox")}` : ""}`, lang)
                : t("gpsRequest")}
          </p>
        )}
      </header>

      <main className="violet-premium awqaat-main mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <section id="home" className={cn("glassy-hero awqaat-hero scroll-mt-24 relative mx-auto max-w-xl overflow-hidden rounded-[2rem] p-6 text-white shadow-soft sm:p-8", !showHome && "hidden")}>
          <div className="islamic-pattern absolute inset-0 opacity-60" aria-hidden />
          <div className="relative flex flex-col items-stretch gap-6">
            <div id="clock" className="awqaat-clock-block scroll-mt-28 text-center">
              <p className="text-sm uppercase tracking-[0.3em] text-gold" dir="auto">
                {gps.location ? t("gpsYours") : locationLabel}
              </p>
              <p className="mb-6 text-xs opacity-70">
                {localizeDigits(gps.location
                  ? `${gps.location.latitude.toFixed(4)}°N, ${gps.location.longitude.toFixed(4)}°E · GPS accuracy ±${Math.round(gps.location.accuracy)} m`
                  : city ? `${city}, ${district.name}, ${state.name} · ${t("addressEstimate")}`
                  : district.lat !== undefined && district.lng !== undefined
                    ? `${state.name} · ${district.lat.toFixed(4)}°N, ${district.lng.toFixed(4)}°E · ${district.mode === "hq" ? t("hqReference") : t("districtCentre")}`
                    : `${district.name}, ${state.name} · ${t("addressEstimate")}`, lang)}
              </p>
              {now ? <Clock now={now} mode={clockMode} h12={h12} lang={lang} /> : <div className="h-24" />}
            </div>
            <div className="glass-on-dark rounded-3xl border border-white/25 p-5 text-center text-white backdrop-blur-xl">
              <p className="text-sm uppercase tracking-widest text-gold" dir="auto">{t("next")}</p>
              {next ? (
                <>
                  <p className="mt-3 font-arabic text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl" dir="rtl" lang="ar">
                    {CARDS.find((c) => c.key === next.key)?.ar}
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold leading-none tracking-wide text-white drop-shadow-sm">{next.key}</p>
                  <p className="mt-5 text-xs uppercase tracking-widest opacity-80" dir="auto">{t("remaining")}{next.tomorrow ? ` · ${t("tomorrow")}` : ""}</p>
                  <p className="awqaat-countdown font-mono font-extrabold tabular-nums" dir="ltr">{localizeDigits(formatHMS(next.secondsLeft), lang)}</p>
                </>
              ) : (
                <p className="mt-4 opacity-80">{pt.error ? localizeDigits(pt.error, lang) : "Loading…"}</p>
              )}
            </div>
          </div>
        </section>

        <section id="prayers" className={cn("glass-shell awqaat-prayer-panel scroll-mt-24 mx-auto max-w-xl rounded-[2rem] p-4 sm:p-6", !showHome && "hidden")}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold" dir="auto">{t("todays")}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {pt.fetchedAt && <span>{t("updated")}: {localizeDigits(new Date(pt.fetchedAt).toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-arab" : "en-IN", { timeZone: TZ }), lang)}{pt.fromCache ? ` (${t("cached")})` : ""}</span>}
              <Button variant="ghost" size="sm" onClick={pt.reload} disabled={pt.loading}><RefreshCw className={cn("h-3 w-3", pt.loading && "animate-spin")} />{t("retry")}</Button>
            </div>
          </div>
          {pt.error && <p className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{localizeDigits(pt.error, lang)}</p>}
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
                    <p className="whitespace-nowrap font-mono text-xl font-bold tabular-nums sm:text-2xl" dir="ltr">
                      {displayedTimings ? localizeDigits(formatTime(displayedTimings[c.key], h12), lang) : "--:--"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {activeTab === "qibla" && (
          <QiblaCompass
            active={true}
            lang={lang}
            position={qiblaPosition}
            locationName={gps.location ? t("gpsYours") : city ? city + ", " + district.name + ", " + state.name : district.name + ", " + state.name}
            gpsEnabled={gps.enabled}
            gpsLocating={gps.locating}
            gpsError={gps.error}
            onGpsClick={gps.toggle}
          />
        )}

        {/* Keep both tools mounted while navigating: audio scheduling and running stopwatch persist. */}
        <section
          id="azan"
          className={cn("mx-auto max-w-xl scroll-mt-24", activeTab !== "azan" && activeTab !== "reminder" && "hidden")}
          aria-label={activeTab === "reminder" ? t("azanReminders") : t("azan")}
        >
          <AzanPlayer
            title={activeTab === "reminder" ? t("azanReminders") : t("azan")}
            lang={lang}
            view={activeTab === "reminder" ? "reminders" : "player"}
            standardSrc="/audio/al-hafiz-muhammed-noufal.mp3"
            now={now}
            timings={displayedTimings}
          />
        </section>
        <section id="stopwatch" className={cn("mx-auto max-w-xl scroll-mt-24", activeTab !== "stopwatch" && "hidden")}>
          <Stopwatch title={t("stopwatch")} lang={lang} />
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-2 px-4 py-5 text-xs text-muted-foreground">
          <p className="font-semibold tracking-wide">JAMIA AWQAAT <span aria-hidden="true">·</span> {t("footerBrand")}</p>
          <details className="group max-w-full text-right">
            <summary className="cursor-pointer select-none rounded-lg px-2 py-1 text-[11px] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              {t("infoCredits")}
            </summary>
            <div className="mt-3 max-w-xl space-y-2 rounded-xl border border-white/15 bg-background/60 p-3 text-left text-[11px] leading-relaxed">
              <p>{t("apiWarning")}. {t("apiCaution")} {!gps.location && (city || district.mode !== "hq") && t("approxWarning")}</p>
              <p>{t("source")}: AlAdhan API (api.aladhan.com) · {t("method")}: {localizeDigits(methodName, lang)} · Asr: {school === 0 ? t("shafii") : t("hanafi")} · {t("timezone")}: {TZ}</p>
              <p>{gps.location ? t("footerGps") : t("footerDistrict")}</p>
              <p>{t("footerSharing")}</p>
              <p>{t("districtSource")} <a href="https://github.com/kalyangupta12/indian-cities-data" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">LGD data (MIT)</a> · <a href="https://github.com/open-admin-data/india-administrative-divisions" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Open Admin Data (CC BY 4.0)</a> · <a href="https://github.com/infenia/indian-district-coordinates" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Infenia centroids (MIT)</a>.</p>
              <p>{t("photography")} <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Unsplash</a>.</p>
            </div>
          </details>
        </div>
      </footer>
      <nav className={cn("glass-bottom-nav", settingsOpen && "settings-nav-open")} aria-label={t("navHome") + " / " + t("settings")}>
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
