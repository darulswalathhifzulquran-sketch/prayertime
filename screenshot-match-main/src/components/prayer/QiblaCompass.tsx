import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Compass, LocateFixed, MapPin, RotateCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localizeDigits, tr, type Lang } from "@/lib/i18n";

type Position = { lat: number; lng: number; source: "gps" | "district" | "address" };
type CompassOrientation = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};
type PermissionOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<"granted" | "denied">;
};
type SensorStatus = "idle" | "requesting" | "waiting" | "live" | "denied" | "no-events" | "relative-only" | "unavailable";
type Heading = { value: number; continuous: number; accuracy?: number };
const KAABA = { lat: 21.422487, lng: 39.826206 } as const;
const radians = (n: number) => n * Math.PI / 180;
const normalize = (n: number) => ((n % 360) + 360) % 360;
const shortestChange = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** Clockwise initial great-circle bearing to the Kaaba, relative to true north. */
export function qiblaBearing(latitude: number, longitude: number) {
  const phi = radians(latitude);
  const target = radians(KAABA.lat);
  const difference = radians(KAABA.lng - longitude);
  const east = Math.sin(difference) * Math.cos(target);
  const north = Math.cos(phi) * Math.sin(target) -
    Math.sin(phi) * Math.cos(target) * Math.cos(difference);
  return normalize(Math.atan2(east, north) * 180 / Math.PI);
}

/* This is a VECTOR COMPASS, not an image. The silver/white/black/red colours
   match the supplied example, while dial and needle can rotate independently. */
function CompassDial({ bearing, heading, lang, alt }: {
  bearing: number | null; heading: Heading | null; lang: Lang; alt: string;
}) {
  const headingAngle = heading?.continuous ?? 0;
  const directionAngle = bearing === null ? null : bearing - headingAngle;
  const ticks = useMemo(() => Array.from({ length: 120 }, (_, i) => i), []);
  const directions = [
    { label: "N", x: 180, y: 83 }, { label: "NE", x: 250, y: 112 },
    { label: "E", x: 279, y: 184 }, { label: "SE", x: 252, y: 257 },
    { label: "S", x: 180, y: 285 }, { label: "SW", x: 108, y: 257 },
    { label: "W", x: 81, y: 184 }, { label: "NW", x: 108, y: 112 },
  ];

  return (
    <svg className="qibla-live-dial" viewBox="0 0 360 360" role="img" aria-label={alt}>
      <defs>
        <linearGradient id="awqaat-bezel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="21%" stopColor="#858585"/>
          <stop offset="53%" stopColor="#e9e9e9"/>
          <stop offset="78%" stopColor="#707070"/>
          <stop offset="100%" stopColor="#f4f4f4"/>
        </linearGradient>
        <radialGradient id="awqaat-face" cx="37%" cy="29%" r="78%">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="80%" stopColor="#f0f0f0"/>
          <stop offset="100%" stopColor="#d3d3d3"/>
        </radialGradient>
        <linearGradient id="awqaat-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#740b0b"/>
          <stop offset="42%" stopColor="#ff3131"/>
          <stop offset="100%" stopColor="#c40000"/>
        </linearGradient>
      </defs>
      <circle cx="180" cy="180" r="177" fill="#666" stroke="#c1c1c1" strokeWidth="2"/>
      <circle cx="180" cy="180" r="171" fill="url(#awqaat-bezel)" stroke="#6a6a6a" strokeWidth="2.5"/>
      <circle cx="180" cy="180" r="156" fill="#a5a5a5" stroke="#e9e9e9" strokeWidth="3"/>
      <circle cx="180" cy="180" r="148" fill="url(#awqaat-face)" stroke="#a2a2a2" strokeWidth="1.6"/>
      <g className="qibla-rose-rotation" style={{ transform: "rotate(" + (-headingAngle) + "deg)" }}>
        <circle cx="180" cy="180" r="136" fill="none" stroke="#555" strokeWidth=".65" opacity=".52"/>
        {ticks.map((tick) => (
          <line key={tick} x1="180" y1={tick % 10 === 0 ? "30" : tick % 5 === 0 ? "35" : "39"}
            x2="180" y2="46" stroke="#434343"
            strokeWidth={tick % 10 === 0 ? "1.7" : tick % 5 === 0 ? "1.1" : ".57"}
            opacity={tick % 10 === 0 ? "0.86" : "0.65"}
            transform={"rotate(" + tick * 3 + " 180 180)"}/>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <text key={i} x="180" y="60" textAnchor="middle" fontSize="9"
            fontWeight="600" fill="#4f4f4f" transform={"rotate(" + i * 30 + " 180 180)"}>
            {localizeDigits(i * 30, lang)}
          </text>
        ))}
        <path d="M180 89 L190 179 L180 167 L170 179 Z" fill="#111" stroke="#333" strokeWidth=".8"/>
        <path d="M180 271 L170 181 L180 193 L190 181 Z" fill="#303030" stroke="#555" strokeWidth=".8"/>
        <path d="M89 180 L179 170 L167 180 L179 190 Z" fill="#050505"/>
        <path d="M271 180 L181 190 L193 180 L181 170 Z" fill="#202020"/>
        <path d="M117 117 L177 168 L169 180 Z M243 117 L183 168 L191 180 Z M243 243 L183 192 L191 180 Z M117 243 L177 192 L169 180 Z" fill="#242424"/>
        {directions.map((d) => (
          <text key={d.label} x={d.x} y={d.y} textAnchor="middle"
            fontSize={d.label.length === 1 ? "18" : "13"} fontWeight="800"
            fill={d.label === "N" ? "#bd0b0b" : "#111"}>{d.label}</text>
        ))}
      </g>
      {directionAngle !== null && (
        <g className="qibla-needle-rotation" style={{ transform: "rotate(" + directionAngle + "deg)" }}>
          <path d="M180 64 L169 191 L180 174 L191 191 Z" fill="url(#awqaat-red)" stroke="#920000" strokeWidth="1"/>
          <path d="M180 297 L169 187 L180 194 L191 187 Z" fill="#454545" stroke="#171717" strokeWidth="1"/>
          <path d="M180 69 L177 170 L180 166 Z" fill="#ffaeae" opacity=".8"/>
        </g>
      )}
      <circle cx="180" cy="180" r="15" fill="#555" stroke="#111" strokeWidth="2"/>
      <circle cx="180" cy="180" r="10.5" fill="url(#awqaat-bezel)" stroke="#ddd" strokeWidth="1.2"/>
      <circle cx="180" cy="180" r="4" fill="#333"/>
      <circle cx="180" cy="180" r="147" fill="none" stroke="#fff" strokeWidth="1" opacity=".62"/>
    </svg>
  );
}

export function QiblaCompass({
  active, lang, position, locationName, gpsEnabled, gpsLocating, gpsError, onGpsClick,
}: {
  active: boolean;
  lang: Lang;
  position: Position | null;
  locationName: string;
  gpsEnabled: boolean;
  gpsLocating: boolean;
  gpsError: string;
  onGpsClick: () => void;
}) {
  const t = tr(lang);
  const [sensorEnabled, setSensorEnabled] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>("idle");
  const [heading, setHeading] = useState<Heading | null>(null);
  const headingRef = useRef<Heading | null>(null);
  const lastEventRef = useRef(0);
  const sawRelativeRef = useRef(false);
  const bearing = useMemo(
    () => position ? qiblaBearing(position.lat, position.lng) : null,
    [position?.lat, position?.lng],
  );
  const relative = heading && bearing !== null ? normalize(bearing - heading.value) : null;
  const aligned = relative !== null && Math.min(relative, 360 - relative) < 8;

  useEffect(() => {
    if (!active || !sensorEnabled) return;
    const onOrientation = (raw: DeviceOrientationEvent) => {
      const event = raw as CompassOrientation;
      let value: number | null = null;
      if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
        value = event.webkitCompassHeading;
      } else if (event.absolute === true && event.alpha !== null && Number.isFinite(event.alpha)) {
        value = normalize(360 - event.alpha);
      }
      if (value === null) {
        sawRelativeRef.current = true;
        return;
      }
      const now = performance.now();
      if (now - lastEventRef.current < 60) return;
      lastEventRef.current = now;
      const normalized = normalize(value);
      const prev = headingRef.current;
      const next: Heading = {
        value: normalized,
        continuous: prev ? prev.continuous + shortestChange(normalized, prev.value) : normalized,
        ...(typeof event.webkitCompassAccuracy === "number" &&
          Number.isFinite(event.webkitCompassAccuracy) ? { accuracy: event.webkitCompassAccuracy } : {}),
      };
      headingRef.current = next;
      setHeading(next);
      setSensorStatus("live");
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
    };
  }, [active, sensorEnabled]);

  useEffect(() => {
    if (!active || !sensorEnabled || sensorStatus !== "waiting") return;
    const timeout = window.setTimeout(() => {
      setSensorStatus((state) => state === "waiting" ?
        sawRelativeRef.current ? "relative-only" : "no-events" : state);
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [active, sensorEnabled, sensorStatus]);

  const enableSensor = async () => {
    if (!window.isSecureContext) {
      setSensorStatus("unavailable");
      return;
    }
    const ctor = (window as Window & { DeviceOrientationEvent?: PermissionOrientation }).DeviceOrientationEvent;
    if (!ctor) {
      setSensorStatus("unavailable");
      return;
    }
    setSensorStatus("requesting");
    try {
      // Magnetometer / absolute-heading permission matters for actual Qibla.
      // Passing true is essential where the modern API supports it.
      if (typeof ctor.requestPermission === "function") {
        const permission = await ctor.requestPermission(true);
        if (permission !== "granted") {
          setSensorStatus("denied");
          return;
        }
      }
      sawRelativeRef.current = false;
      headingRef.current = null;
      lastEventRef.current = 0;
      setHeading(null);
      setSensorEnabled(true);
      setSensorStatus("waiting");
    } catch {
      setSensorStatus("denied");
    }
  };

  const sensorMessage =
    sensorStatus === "denied" ? t("qiblaSensorDenied")
      : sensorStatus === "unavailable" ? t("qiblaSensorUnavailable")
      : sensorStatus === "relative-only" ? t("qiblaRelativeOnly")
      : sensorStatus === "no-events" ? t("qiblaNoEvents")
      : sensorStatus === "requesting" || sensorStatus === "waiting" ? t("qiblaSensorWaiting")
      : sensorStatus === "live" ? t("qiblaSensorLiveHint")
      : t("qiblaManualHint");

  return (
    <section id="qibla" className="qibla-section mx-auto max-w-xl scroll-mt-24">
      <div className="glass-shell qibla-panel rounded-[2rem] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-fuchsia-200">AWQAAT</p>
            <h2 className="font-display text-2xl font-semibold" dir="auto">{t("qiblaTitle")}</h2>
            <p className="mt-1 text-xs text-fuchsia-100/80" dir="auto">{t("qiblaSubtitle")}</p>
          </div>
          <span className="qibla-heading-icon" aria-hidden="true"><Compass size={25}/></span>
        </div>

        <div className="qibla-dial-frame">
          <div className="qibla-vector-wrap">
            <CompassDial bearing={bearing} heading={heading} lang={lang} alt={t("qiblaTitle")} />
          </div>
          <p className="qibla-photo-legend" dir="auto">
            <span className="qibla-legend-dot" />
            {heading ? t("qiblaLivePointerInfo") : t("qiblaStaticPointerInfo")}
          </p>
        </div>

        <div className="qibla-data-grid">
          <div className="qibla-stat">
            <span>{t("qiblaBearing")}</span>
            <strong className="font-mono" dir="ltr">{bearing === null ? "—" : localizeDigits(bearing.toFixed(1), lang) + "°"}</strong>
            <small>{t("qiblaFromNorth")}</small>
          </div>
          <div className="qibla-stat">
            <span>{t("qiblaPhoneHeading")}</span>
            <strong className="font-mono" dir="ltr">{heading === null ? "—" : localizeDigits(heading.value.toFixed(1), lang) + "°"}</strong>
            <small>{sensorStatus === "live" ? t("qiblaLive") : t("qiblaStatic")}</small>
          </div>
        </div>

        <div className="qibla-location-line" dir="auto">
          <MapPin size={16} aria-hidden="true"/>
          <span>{locationName}</span>
          <span className="qibla-source">
            {position?.source === "gps" ? "GPS" : position?.source === "address" ?
              t("qiblaAddressSource") : t("qiblaDistrictSource")}
          </span>
        </div>

        {!position && <p className="qibla-note" role="status"><ShieldAlert size={16}/>{t("qiblaLocationNeeded")}</p>}
        {gpsError && !position && <p className="qibla-note" role="alert">{gpsError}</p>}
        <div className="qibla-actions">
          <Button type="button" onClick={onGpsClick}
            variant={gpsEnabled ? "outline" : "default"} disabled={gpsLocating}
            className="qibla-gps-button rounded-xl">
            <LocateFixed size={17} className={gpsLocating ? "animate-pulse" : ""}/>
            {gpsLocating ? t("gpsRequest") : gpsEnabled ? t("qiblaGpsOn") : t("qiblaUseGps")}
          </Button>
          <Button type="button" variant="outline" onClick={enableSensor}
            disabled={sensorStatus === "requesting" || sensorStatus === "waiting" || sensorStatus === "live"}
            className="qibla-sensor-button rounded-xl">
            <RotateCw size={17}/>
            {sensorStatus === "live" ? t("qiblaSensorActive") :
              sensorStatus === "requesting" || sensorStatus === "waiting" ? t("qiblaSensorWaiting") :
              t("qiblaEnableSensor")}
          </Button>
        </div>

        {aligned && sensorStatus === "live" && (
          <p className="qibla-aligned" role="status"><CheckCircle2 size={18}/>{t("qiblaAligned")}</p>
        )}
        <p className="qibla-guidance" role="status" aria-live="polite" dir="auto">{sensorMessage}</p>
        {heading?.accuracy !== undefined && heading.accuracy > 25 && (
          <p className="qibla-note"><ShieldAlert size={16}/>{t("qiblaCalibrate")}</p>
        )}
        <p className="qibla-how-it-works" dir="auto">{t("qiblaHowItWorks")}</p>
      </div>
    </section>
  );
}
