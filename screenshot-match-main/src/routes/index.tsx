import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, LocateFixed, Moon, RefreshCw, Settings, Sun, Sunrise } from "lucide-react";
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
import { CARDS, DEFAULT_METHOD, DISTRICTS, METHODS, TZ, formatHMS, formatTime, istSecondsOfDay, nearestDistrict, nextPrayer } from "@/lib/prayer";
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
  const pt = usePrayerTimes(district, method);
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);

  const next = now && pt.today ? nextPrayer(pt.today, istSecondsOfDay(now), pt.tomorrowFajr) : null;
  const methodName = METHODS.find((m) => m.id === method)?.name ?? `Method ${method}`;

  const locate = () => {
    if (!navigator.geolocation) return setGeoMsg("Location not supported on this device.");
    navigator.geolocation.getCurrentPosition(
      (p) => { const d = nearestDistrict(p.coords.latitude, p.coords.longitude); setDistrictId(d.id); setGeoMsg(`Nearest district: ${d.en}`); },
      () => setGeoMsg("Location permission was not given."),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero font-arabic text-lg text-gold">۞</span>
            <span className="font-display text-2xl font-semibold">{t("title")}</span>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-56 justify-between" aria-label={t("district")}>
                {lang === "ml" ? district.ml : district.en}<ChevronsUpDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <Command>
                <CommandInput placeholder={t("search")} />
                <CommandList>
                  <CommandEmpty>—</CommandEmpty>
                  <CommandGroup>
                    {DISTRICTS.map((d) => (
                      <CommandItem key={d.id} value={`${d.en} ${d.ml}`} onSelect={() => { setDistrictId(d.id); setOpen(false); }}>
                        <Check className={cn("h-4 w-4", d.id === district.id ? "opacity-100" : "opacity-0")} />
                        {d.en} <span className="ml-auto font-ml text-xs text-muted-foreground">{d.ml}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={locate} aria-label={t("locate")}><LocateFixed /></Button>
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Theme">{theme === "dark" ? <Sun /> : <Moon />}</Button>
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label={t("settings")}><Settings /></Button></SheetTrigger>
            <SheetContent>
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
        {geoMsg && <p className="pb-2 text-center text-xs text-muted-foreground">{geoMsg}</p>}
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-hero p-6 shadow-soft sm:p-10">
          <div className="islamic-pattern absolute inset-0 opacity-60" aria-hidden />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div className="text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-gold">{lang === "ml" ? district.ml : district.en}</p>
              <p className="mb-6 text-xs opacity-70">{district.hq} · {district.lat.toFixed(4)}°N, {district.lng.toFixed(4)}°E</p>
              {now ? <Clock now={now} mode={clockMode} h12={h12} lang={lang} /> : <div className="h-24" />}
            </div>
            <div className="rounded-3xl border border-gold/40 bg-background/10 p-6 text-center backdrop-blur">
              <p className="text-sm uppercase tracking-widest text-gold">{t("next")}</p>
              {next ? (
                <>
                  <p className="mt-2 font-display text-5xl font-semibold">{next.key}</p>
                  <p className="font-arabic text-2xl" dir="rtl" lang="ar">{CARDS.find((c) => c.key === next.key)?.ar}</p>
                  <p className="mt-4 text-xs uppercase tracking-widest opacity-70">{t("remaining")}{next.tomorrow ? ` · ${t("tomorrow")}` : ""}</p>
                  <p className="font-mono text-5xl tabular-nums">{formatHMS(next.secondsLeft)}</p>
                </>
              ) : (
                <p className="mt-4 opacity-80">{pt.error ?? "Loading…"}</p>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-3xl font-semibold">{t("todays")}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {pt.fetchedAt && <span>{t("updated")}: {new Date(pt.fetchedAt).toLocaleString("en-IN", { timeZone: TZ })}{pt.fromCache ? ` (${t("cached")})` : ""}</span>}
              <Button variant="ghost" size="sm" onClick={pt.reload} disabled={pt.loading}><RefreshCw className={cn("h-3 w-3", pt.loading && "animate-spin")} />{t("retry")}</Button>
            </div>
          </div>
          {pt.error && <p className="mb-4 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{pt.error}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CARDS.map((c) => {
              const isNext = next?.key === c.key;
              const sunrise = c.key === "Sunrise";
              return (
                <article key={c.key} className={cn(
                  "relative rounded-3xl border bg-card p-5 shadow-soft transition-all",
                  isNext && "ring-2 ring-gold -translate-y-1",
                  sunrise && "border-dashed bg-muted",
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{c.en}</h3>
                      <p className="font-ml text-sm text-muted-foreground">{c.ml}</p>
                    </div>
                    <p className="font-arabic text-2xl text-primary" dir="rtl" lang="ar">{c.ar}</p>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <p className="font-mono text-3xl font-semibold tabular-nums">{pt.today ? formatTime(pt.today[c.key], h12) : "--:--"}</p>
                    {sunrise ? <Sunrise className="h-7 w-7 text-gold" /> : isNext ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{t("upcoming")}</span> : null}
                  </div>
                  {sunrise && <p className="mt-2 text-xs text-muted-foreground">{t("notPrayer")}</p>}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <AzanPlayer title={t("azan")} now={now} timings={pt.today} />
          <Stopwatch title={t("stopwatch")} />
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-xs text-muted-foreground">
          <p>Source: AlAdhan API (api.aladhan.com) · Method: {methodName} · Asr: Shafi'i · Timezone: {TZ}</p>
          {pt.fetchedAt && <p>{t("updated")}: {new Date(pt.fetchedAt).toLocaleString("en-IN", { timeZone: TZ })}</p>}
          <p>These are calculated times and can differ by a few minutes from your local mosque timetable. Please follow your local masjid.</p>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-2 font-medium">{label}</p>{children}</div>;
}
