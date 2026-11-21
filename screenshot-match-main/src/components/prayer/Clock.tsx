import { istParts, TZ } from "@/lib/prayer";
import { MoonStar } from "lucide-react";
import { formatHijriDate, type HijriAdjustment } from "@/lib/hijri-date";
import { localizeDigits, tr, type Lang } from "@/lib/i18n";

export function Clock({ now, mode, h12, lang, maghrib, hijriCorrection }: { now: Date; mode: "digital" | "analog"; h12: boolean; lang: Lang; maghrib?: string; hijriCorrection: HijriAdjustment }) {
  const p = istParts(now);
  const t = tr(lang);
  const hijriDate = formatHijriDate(now, lang, maghrib, hijriCorrection);
  const date = new Intl.DateTimeFormat(lang === "ml" ? "ml-IN" : lang === "ar" ? "ar-SA-u-ca-gregory-nu-arab" : "en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const hh = h12 ? ((p.h + 11) % 12) + 1 : p.h;
  const pad = (n: number) => localizeDigits(String(n).padStart(2, "0"), lang);
  return (
    <div className="awqaat-clock-face flex min-w-0 flex-col items-center gap-3">
      {mode === "digital" ? (
        <div className="awqaat-clock-display flex items-baseline gap-2 font-mono tabular-nums" dir="ltr">
          <span className="awqaat-clock-primary font-semibold">{pad(hh)}:{pad(p.mi)}</span>
          <span className="awqaat-clock-seconds text-gold">{pad(p.s)}</span>
          {h12 && <span className="awqaat-clock-meridiem font-sans font-semibold text-gold">{p.h < 12 ? "AM" : "PM"}</span>}
        </div>
      ) : (
        <Analog h={p.h} m={p.mi} s={p.s} />
      )}
      {mode === "analog" && (
        <div className="font-mono text-lg tabular-nums" dir="ltr">{pad(hh)}:{pad(p.mi)}:{pad(p.s)} {h12 ? (p.h < 12 ? "AM" : "PM") : ""}</div>
      )}
      <div className="text-sm opacity-80" dir="auto">{localizeDigits(date, lang)}</div>
      <div className="awqaat-hijri-date mt-1 inline-flex max-w-full flex-col items-center gap-1.5 rounded-2xl border border-amber-200/30 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,.13)] backdrop-blur-lg">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-amber-200">
          <MoonStar className="h-3.5 w-3.5" aria-hidden="true" />{t("hijriLabel")}
        </span>
        <span className="font-display text-base font-semibold leading-snug text-white sm:text-lg" dir="auto">{hijriDate}</span>
        <span className="text-center text-[10px] leading-relaxed text-white/70" dir="auto">{t("hijriEstimate")}</span>
      </div>
    </div>
  );
}

function Analog({ h, m, s }: { h: number; m: number; s: number }) {
  const hand = (deg: number, len: number, w: number, cls: string) => (
    <line x1="100" y1="100" x2="100" y2={100 - len} strokeWidth={w} strokeLinecap="round" className={cls} transform={`rotate(${deg} 100 100)`} />
  );
  return (
    <svg viewBox="0 0 200 200" className="awqaat-analog-clock h-48 w-48" role="img" aria-label="Analog clock">
      <circle cx="100" cy="100" r="94" className="fill-none stroke-gold" strokeWidth="2" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i} x1="100" y1="12" x2="100" y2={i % 3 ? 20 : 26} className="stroke-current" strokeWidth={i % 3 ? 2 : 3} transform={`rotate(${i * 30} 100 100)`} />
      ))}
      {hand(((h % 12) + m / 60) * 30, 48, 6, "stroke-current")}
      {hand((m + s / 60) * 6, 70, 4, "stroke-current")}
      {hand(s * 6, 78, 1.5, "stroke-gold")}
      <circle cx="100" cy="100" r="5" className="fill-gold" />
    </svg>
  );
}
