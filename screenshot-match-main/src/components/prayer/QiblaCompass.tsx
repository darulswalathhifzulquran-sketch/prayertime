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
  const lastReliableRef = useRef(0);
  const sawRelativeRef = useRef(false);
  // A single absolute-heading source is used at a time. Mixing the two
  // browser orientation event streams makes a compass oscillate badly.
  const sourceRef = useRef<"webkit" | "absolute-event" | "absolute" | null>(null);
  const sourceSeenRef = useRef(0);
  const readingsRef = useRef<number[]>([]);
  const previousRawRef = useRef<{ value: number; at: number } | null>(null);
  const jumpCountRef = useRef(0);
  const stableCountRef = useRef(0);
  const alignmentStartRef = useRef<number | null>(null);
  const [stableAligned, setStableAligned] = useState(false);
  const [unstable, setUnstable] = useState(false);
  const bearing = useMemo(
    () => position ? qiblaBearing(position.lat, position.lng) : null,
    [position?.lat, position?.lng],
  );
  // The alignment indicator uses a time-based hold and a wider exit threshold:
  // a momentary sensor spike cannot make it flash on/off.
  const relative = heading && bearing !== null ? normalize(bearing - heading.value) : null;
  const aligned = stableAligned && !unstable && sensorStatus === "live" && relative !== null &&
    Math.min(relative, 360 - relative) <= 10;

  useEffect(() => {
    if (!active || !sensorEnabled) return;

    const onOrientation = (raw: DeviceOrientationEvent) => {
      const event = raw as CompassOrientation;
      let value: number | null = null;
      let source: "webkit" | "absolute-event" | "absolute" | null = null;
      if (typeof event.webkitCompassHeading === "number" &&
          Number.isFinite(event.webkitCompassHeading)) {
        value = event.webkitCompassHeading;
        source = "webkit";
      } else if (event.alpha !== null && Number.isFinite(event.alpha) &&
                 (raw.type === "deviceorientationabsolute" || event.absolute === true)) {
        value = normalize(360 - event.alpha);
        source = raw.type === "deviceorientationabsolute" ? "absolute-event" : "absolute";
      }
      if (value === null || source === null) {
        sawRelativeRef.current = true;
        return;
      }

      const now = performance.now();
      const priority = { webkit: 3, "absolute-event": 2, absolute: 1 };
      const previousSource = sourceRef.current;
      // Chrome may dispatch both deviceorientation and deviceorientationabsolute.
      // Those streams can disagree, so choose the higher-quality source and
      // ignore its lower-priority counterpart while data is arriving.
      if (previousSource && source !== previousSource) {
        if (priority[source] <= priority[previousSource] &&
            now - sourceSeenRef.current < 2300) return;
        readingsRef.current = [];
        previousRawRef.current = null;
      }
      sourceRef.current = source;
      sourceSeenRef.current = now;

      // At most 8 heading updates per second. A constant high-frequency sensor
      // feed is not a reason to repaint the complete 120-tick SVG repeatedly.
      if (now - lastEventRef.current < 125) return;
      lastEventRef.current = now;
      lastReliableRef.current = now;

      const normalized = normalize(value);
      const priorRaw = previousRawRef.current;
      const abrupt = priorRaw !== null && now - priorRaw.at < 350 &&
        Math.abs(shortestChange(normalized, priorRaw.value)) > 35;
      previousRawRef.current = { value: normalized, at: now };
      if (abrupt) {
        jumpCountRef.current = Math.min(jumpCountRef.current + 2, 8);
        stableCountRef.current = 0;
      } else {
        jumpCountRef.current = Math.max(0, jumpCountRef.current - 1);
        stableCountRef.current += 1;
      }

      const accuracy = typeof event.webkitCompassAccuracy === "number" &&
        Number.isFinite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : undefined;
      const poorAccuracy = accuracy !== undefined && accuracy > 25;
      const unreliable = poorAccuracy || jumpCountRef.current >= 4;
      // Sensor instability must not falsely certify "Facing Qibla".
      setUnstable(unreliable);
      if (unreliable) {
        alignmentStartRef.current = null;
        setStableAligned(false);
      }

      // Circular median over the five most recent readings removes spikes
      // across the 359°/0° boundary without introducing 180° wrap errors.
      const window = readingsRef.current;
      window.push(normalized);
      if (window.length > 5) window.shift();
      const prev = headingRef.current;
      const anchor = prev?.value ?? normalized;
      const offsets = window.map((angle) => shortestChange(angle, anchor))
        .sort((a, b) => a - b);
      const median = offsets[Math.floor(offsets.length / 2)] ?? 0;
      const delta = prev ? median : 0;
      // Adaptive circular low-pass: almost static phones use strong damping,
      // but deliberate rotations still catch up smoothly.
      const gain = Math.abs(delta) > 20 ? 0.5 : Math.abs(delta) > 8 ? 0.35 : 0.22;
      const step = Math.max(-18, Math.min(18, delta * gain));
      const nextContinuous = prev ? prev.continuous + (Math.abs(delta) < 1.5 ? 0 : step) : normalized;
      const nextValue = normalize(nextContinuous);
      const next: Heading = {
        value: nextValue,
        continuous: nextContinuous,
        ...(accuracy === undefined ? {} : { accuracy }),
      };

      // Even if the needle is inside the 1.5° deadband, incoming samples are
      // counted for steady alignment; the marker itself stays still.
      if (bearing !== null && !unreliable) {
        const error = Math.abs(shortestChange(bearing, nextValue));
        if (error <= 5) {
          if (alignmentStartRef.current === null) alignmentStartRef.current = now;
          if (now - alignmentStartRef.current >= 750) setStableAligned(true);
        } else if (error >= 10) {
          alignmentStartRef.current = null;
          setStableAligned(false);
        }
      } else {
        alignmentStartRef.current = null;
        setStableAligned(false);
      }

      if (!prev || Math.abs(nextContinuous - prev.continuous) >= 0.1 ||
          (prev.accuracy !== accuracy)) {
        headingRef.current = next;
        setHeading(next);
      }
      setSensorStatus("live");
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
    };
  }, [active, sensorEnabled, bearing]);

  // Do not keep reporting a live working compass when device readings stop.
  useEffect(() => {
    if (!active || sensorStatus !== "live") return;
    const timer = window.setInterval(() => {
      if (performance.now() - lastReliableRef.current < 4000) return;
      setSensorStatus("no-events");
      setStableAligned(false);
      alignmentStartRef.current = null;
      headingRef.current = null;
      setHeading(null);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [active, sensorStatus]);

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
      lastReliableRef.current = 0;
      sourceRef.current = null;
      sourceSeenRef.current = 0;
      readingsRef.current = [];
      previousRawRef.current = null;
      jumpCountRef.current = 0;
      stableCountRef.current = 0;
      alignmentStartRef.current = null;
      setStableAligned(false);
      setUnstable(false);
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
        {sensorStatus !== "idle" && sensorStatus !== "live" && sensorStatus !== "relative-only" && (
          <p className="qibla-guidance" role="status" aria-live="polite" dir="auto">{sensorMessage}</p>
        )}
        {unstable && (
          <p className="qibla-note" role="alert"><ShieldAlert size={16}/>{t("qiblaSensorUnstable")}</p>
        )}
      </div>
    </section>
  );
}
