import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Compass, LocateFixed, RotateCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localizeDigits, tr, type Lang } from "@/lib/i18n";
import { signalQiblaAligned } from "@/lib/prayer-feedback";
import { newMotionTracker, trackHeading, medianHeading, stableHeadingDegree, updateAlignment, type AlignmentState } from "@/lib/compass-motion";
import { magneticDeclination } from "@/lib/wmm2025";
import { KAABA_MARKER } from "@/lib/kaaba-marker";

type Position = { lat: number; lng: number };
type CompassOrientation = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};
type PermissionOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: (absolute?: boolean) => Promise<"granted" | "denied">;
};
type SensorStatus = "idle" | "requesting" | "waiting" | "live" | "denied" | "no-events" | "relative-only" | "unavailable";
type Heading = { value: number; continuous: number; display: number; accuracy?: number };
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

/* iPhone-inspired, original vector compass.
   Compass rose follows the device's heading; the gold Kaaba pointer tracks
   the great-circle Qibla bearing. No image or mock sensor values are used. */
function CompassDial({ bearing, heading, lang, alt }: {
  bearing: number | null; heading: Heading | null; lang: Lang; alt: string;
}) {
  const headingAngle = heading?.continuous ?? 0;
  const directionAngle = bearing === null || heading === null ? null : bearing - headingAngle;
  const ticks = useMemo(() => Array.from({ length: 120 }, (_, i) => i), []);
  const cardinals = [
    { label: "N", a: 0 }, { label: "NE", a: 45 }, { label: "E", a: 90 },
    { label: "SE", a: 135 }, { label: "S", a: 180 }, { label: "SW", a: 225 },
    { label: "W", a: 270 }, { label: "NW", a: 315 },
  ];
  return (
    <svg className="qibla-live-dial" viewBox="0 0 360 360" role="img" aria-label={alt}>
      <defs>
        <radialGradient id="ios-qibla-face" cx="45%" cy="33%" r="77%">
          <stop offset="0%" stopColor="#252e3a" />
          <stop offset="68%" stopColor="#0a111a" />
          <stop offset="100%" stopColor="#02060b" />
        </radialGradient>
        <linearGradient id="ios-qibla-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fff0aa" />
          <stop offset="52%" stopColor="#d5ae55" />
          <stop offset="100%" stopColor="#9a7227" />
        </linearGradient>
      </defs>
      <circle cx="180" cy="180" r="176" fill="#04070d" stroke="#65717e" strokeWidth="2" />
      <circle cx="180" cy="180" r="168" fill="url(#ios-qibla-face)" stroke="#192431" strokeWidth="2" />
      <circle cx="180" cy="180" r="144" fill="none" stroke="#344151" strokeWidth="1" />
      <circle cx="180" cy="180" r="118" fill="none" stroke="#2d3a47" strokeWidth=".8" opacity=".45" />
      <g transform={`rotate(${-headingAngle} 180 180)`}>
        {ticks.map((tick) => (
          <line key={tick} x1="180"
            y1={tick % 10 === 0 ? "19" : tick % 5 === 0 ? "25" : "31"}
            x2="180" y2={tick % 10 === 0 ? "42" : tick % 5 === 0 ? "38" : "35"}
            stroke={tick === 0 ? "#ef5d64" : tick % 10 === 0 ? "#e3ebf5" : "#8191a2"}
            strokeWidth={tick % 10 === 0 ? "2.2" : tick % 5 === 0 ? "1.25" : ".75"}
            opacity={tick % 10 === 0 ? 1 : .62}
            transform={`rotate(${tick * 3} 180 180)`}/>
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <text key={i} x="180" y="61" textAnchor="middle" fontSize="10"
            fontWeight="600" fill="#a8b7c8"
            transform={`rotate(${i * 30} 180 180)`}>
            {localizeDigits(i * 30, lang)}
          </text>
        ))}
        {cardinals.map(({label, a}) => {
          const theta = a * Math.PI / 180;
          return <text key={label}
            x={180 + 109 * Math.sin(theta)}
            y={185 - 109 * Math.cos(theta)}
            textAnchor="middle" fontSize={label.length === 1 ? "20" : "12"}
            fontWeight="800" fill={label === "N" ? "#ff696e" : "#f4f7ff"}
            transform={`rotate(${a} ${180 + 109 * Math.sin(theta)} ${180 - 109 * Math.cos(theta)})`}>
            {label}
          </text>;
        })}
      </g>
      {directionAngle !== null && (
        <g transform={`rotate(${directionAngle} 180 180)`}>
          <path d="M180 72 L165 145 L180 135 L195 145 Z"
            fill="url(#ios-qibla-gold)" stroke="#ffdda1" strokeWidth="1.5"/>
          <path d="M180 313 L166 214 L180 225 L194 214 Z" fill="#637285" stroke="#b8c3d0" strokeWidth=".8" />
          <path d="M180 76 L177 130 L180 125 Z" fill="#fff4d5" opacity=".9"/>
          {/* Rotate the marker's position, not the Kaaba picture itself. */}
          <g transform={`translate(180 46) rotate(${-directionAngle})`}>
            <image href={KAABA_MARKER} x="-18" y="-18" width="36" height="36" preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>
      )}
      <path d="M180 6 L174 20 H186 Z" fill="#ff5b61" stroke="#ff878a" strokeWidth=".6" />
      <circle cx="180" cy="180" r="21" fill="#111a27" stroke="#687586" strokeWidth="1.5"/>
      <circle cx="180" cy="180" r="14" fill="#283646" stroke="#8797a9" strokeWidth="1"/>
      <circle cx="180" cy="180" r="5" fill="#f4d489"/>
      <circle cx="180" cy="180" r="167" fill="none" stroke="#eef5ff" strokeWidth=".6" opacity=".14"/>
    </svg>
  );
}

export function QiblaCompass({ active, lang }: { active: boolean; lang: Lang }) {
  const t = tr(lang);
  // Compass positioning is intentionally independent of prayer settings.
  // Coordinates are used only in memory, and only while this tab is open.
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [gpsAttempt, setGpsAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    // Automatically start on devices that already granted location permission.
    navigator.permissions?.query({ name: "geolocation" }).then((permission) => {
      if (!cancelled && permission.state === "granted") setGpsEnabled(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [active]);
  useEffect(() => {
    if (!active || !gpsEnabled) return;
    if (!navigator.geolocation) { setGpsFailed(true); setGpsLocating(false); return; }
    let cancelled = false;
    setGpsLocating(true);
    setGpsFailed(false);
    const watch = navigator.geolocation.watchPosition(({ coords }) => {
      if (cancelled) return;
      if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
          Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) {
        setPosition(null);
        setGpsFailed(true);
      } else {
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setGpsFailed(false);
      }
      setGpsLocating(false);
    }, () => {
      if (cancelled) return;
      setPosition(null);
      setGpsFailed(true);
      setGpsLocating(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watch);
    };
  }, [active, gpsEnabled, gpsAttempt]);
  const requestCompassPosition = () => {
    setGpsEnabled(true);
    setGpsAttempt((attempt) => attempt + 1);
  };
  const [sensorEnabled, setSensorEnabled] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>("idle");
  const [heading, setHeading] = useState<Heading | null>(null);
  const headingRef = useRef<Heading | null>(null);
  const trackerRef = useRef(newMotionTracker());
  const motionRef = useRef({ seen: 0, turning: 0, integrated: 0 });
  const lastEventRef = useRef(0);
  const lastReliableRef = useRef(0);
  const sawRelativeRef = useRef(false);
  // A single absolute-heading source is used at a time. Mixing the two
  // browser orientation event streams makes a compass oscillate badly.
  const sourceRef = useRef<"webkit" | "absolute-event" | "absolute" | null>(null);
  const sourceSeenRef = useRef(0);
  const previousRawRef = useRef<{ value: number; at: number } | null>(null);
  const jumpCountRef = useRef(0);
  const alignmentRef = useRef<AlignmentState>({ since: null, aligned: false, armed: true });
  const [stableAligned, setStableAligned] = useState(false);
  const [unstable, setUnstable] = useState(false);
  const [tilted, setTilted] = useState(false);
  const tiltRef = useRef(false);
  const bearing = useMemo(
    () => position ? qiblaBearing(position.lat, position.lng) : null,
    [position?.lat, position?.lng],
  );
  // The alignment indicator uses a time-based hold and a wider exit threshold:
  // a momentary sensor spike cannot make it flash on/off.
  // Model correction uses only the compass's private device coordinates.
  const declination = useMemo(() => {
    if (!position) return null;
    try {
      const result = magneticDeclination(position.lat, position.lng);
      return Number.isFinite(result) ? result : null;
    } catch { return null; }
  }, [position?.lat, position?.lng]);
  const relative = heading && bearing !== null && declination !== null ? normalize(bearing - heading.value) : null;
  const aligned = stableAligned && !unstable && !tilted && sensorStatus === "live" && relative !== null &&
    Math.min(relative, 360 - relative) <= 5;

  useEffect(() => {
    if (!active || !sensorEnabled) return;

    const onMotion = (event: DeviceMotionEvent) => {
      const rate = event.rotationRate;
      if (!rate || ![rate.alpha, rate.beta, rate.gamma].every(v => typeof v === "number" && Number.isFinite(v))) return;
      const now = performance.now();
      const m = motionRef.current;
      const dt = m.seen ? Math.min((now - m.seen) / 1000, 0.1) : 0;
      m.seen = now;
      const speed = Math.hypot(rate.alpha!, rate.beta!, rate.gamma!);
      // Detect slow physical turns as well as fast ones, without integrating
      // insignificant stationary gyro drift indefinitely.
      if (Math.abs(rate.alpha!) > 0.45) m.integrated += rate.alpha! * dt;
      else m.integrated *= 0.8;
      if (speed > 2.5 || Math.abs(m.integrated) > 1.2) {
        m.turning = now;
        m.integrated = 0;
      }
    };
    const onOrientation = (raw: DeviceOrientationEvent) => {
      const event = raw as CompassOrientation;
      let value: number | null = null;
      let source: "webkit" | "absolute-event" | "absolute" | null = null;
      if (typeof event.webkitCompassHeading === "number" &&
          Number.isFinite(event.webkitCompassHeading) && event.webkitCompassHeading >= 0) {
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
        previousRawRef.current = null;
        trackerRef.current = newMotionTracker();
      }
      sourceRef.current = source;
      sourceSeenRef.current = now;

      // Follow deliberate movement at up to 40 updates/second, instead of 8.
      const elapsed = lastEventRef.current ? now - lastEventRef.current : 25;
      if (lastEventRef.current && elapsed < 25) return;
      lastEventRef.current = now;
      lastReliableRef.current = now;

      if (declination === null) return; // No uncorrected magnetic heading presented as true north.
      const screenAngle = window.screen.orientation?.angle ?? (typeof window.orientation === "number" ? window.orientation : 0);
      const normalized = normalize(value + declination + screenAngle);
      const priorRaw = previousRawRef.current;
      const abrupt = priorRaw !== null && now - priorRaw.at < 350 &&
        Math.abs(shortestChange(normalized, priorRaw.value)) > 35;
      previousRawRef.current = { value: normalized, at: now };
      if (abrupt) {
        jumpCountRef.current = Math.min(jumpCountRef.current + 2, 8);
      } else {
        jumpCountRef.current = Math.max(0, jumpCountRef.current - 1);
      }

      if (typeof event.beta === "number" && typeof event.gamma === "number" &&
          Number.isFinite(event.beta) && Number.isFinite(event.gamma)) {
        const nextTilted = Math.abs(event.beta) > 27 || Math.abs(event.gamma) > 27;
        if (tiltRef.current !== nextTilted) {
          tiltRef.current = nextTilted;
          setTilted(nextTilted);
        }
      }
      const accuracy = typeof event.webkitCompassAccuracy === "number" &&
        Number.isFinite(event.webkitCompassAccuracy) ? event.webkitCompassAccuracy : undefined;
      const poorAccuracy = accuracy !== undefined && (accuracy < 0 || accuracy > 25);
      const motion = motionRef.current;
      const moving = motion.seen && now - motion.seen < 350 ? (motion.turning > 0 && now - motion.turning < 250) : null;
      const tracked = trackHeading(trackerRef.current, normalized, now, elapsed, moving);
      trackerRef.current = tracked;
      const unreliable = poorAccuracy || tracked.disturbed || (moving !== true && jumpCountRef.current >= 4);
      setUnstable(unreliable);
      const prev = headingRef.current;
      const nextContinuous = tracked.value ?? normalized;
      const nextValue = normalize(nextContinuous);
      const next: Heading = {
        value: nextValue,
        continuous: nextContinuous,
        display: stableHeadingDegree(nextValue, prev?.display ?? null),
        ...(accuracy === undefined ? {} : { accuracy }),
      };

      // Confirm only a real, reliable alignment, without waiting three-quarters
      // of a second. Rearm only after moving away, avoiding repeated vibration.
      const reliable = bearing !== null && !unreliable && !tiltRef.current;
      const filteredError = bearing === null ? 180 : Math.abs(shortestChange(bearing, nextValue));
      const reference = medianHeading(tracked.samples, nextValue);
      const rawError = bearing === null ? 180 : Math.abs(shortestChange(bearing, normalize(reference)));
      const state = updateAlignment(alignmentRef.current, now, filteredError, rawError, reliable);
      alignmentRef.current = state;
      setStableAligned(state.aligned);
      if (state.buzz) signalQiblaAligned();

      headingRef.current = next;
      if (!prev || prev.continuous !== next.continuous || prev.display !== next.display || prev.accuracy !== next.accuracy) setHeading(next);
      setSensorStatus("live");
    };
    window.addEventListener("devicemotion", onMotion);
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
    };
  }, [active, sensorEnabled, bearing, declination]);

  // Do not keep reporting a live working compass when device readings stop.
  useEffect(() => {
    if (!active || sensorStatus !== "live") return;
    const timer = window.setInterval(() => {
      if (performance.now() - lastReliableRef.current < 4000) return;
      setSensorStatus("no-events");
      setStableAligned(false);
      alignmentRef.current = { since: null, aligned: false, armed: alignmentRef.current.armed };
      headingRef.current = null;
      trackerRef.current = newMotionTracker();
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
        const motionCtor = window.DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
        const orientationPermission = ctor.requestPermission(true);
        // Start both requests synchronously within the user gesture.
        if (typeof motionCtor?.requestPermission === "function") void motionCtor.requestPermission().catch(() => {});
        const permission = await orientationPermission;
        if (permission !== "granted") {
          setSensorStatus("denied");
          return;
        }
      }
      // Ask for gyro access in the same explicit user interaction where possible.
      sawRelativeRef.current = false;
      headingRef.current = null;
      trackerRef.current = newMotionTracker();
      motionRef.current = { seen: 0, turning: 0, integrated: 0 };
      lastEventRef.current = 0;
      lastReliableRef.current = 0;
      sourceRef.current = null;
      sourceSeenRef.current = 0;
      previousRawRef.current = null;
      jumpCountRef.current = 0;
      alignmentRef.current = { since: null, aligned: false, armed: true };
      setStableAligned(false);
      setUnstable(false);
      tiltRef.current = false;
      setTilted(false);
      setHeading(null);
      setSensorEnabled(true);
      setSensorStatus("waiting");
    } catch {
      setSensorStatus("denied");
    }
  };

  // Android/other platforms without an explicit permission prompt can start
  // the compass automatically upon opening this tab. On iOS the existing
  // sensor permission button is still required by the operating system.
  useEffect(() => {
    if (!active || sensorEnabled || sensorStatus !== "idle" || !window.isSecureContext) return;
    const ctor = (window as Window & { DeviceOrientationEvent?: PermissionOrientation }).DeviceOrientationEvent;
    if (ctor && typeof ctor.requestPermission !== "function") void enableSensor();
  }, [active, sensorEnabled, sensorStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensorMessage =
    sensorStatus === "denied" ? t("qiblaSensorDenied")
      : sensorStatus === "unavailable" ? t("qiblaSensorUnavailable")
      : sensorStatus === "relative-only" ? t("qiblaRelativeOnly")
      : sensorStatus === "no-events" ? t("qiblaNoEvents")
      : sensorStatus === "requesting" || sensorStatus === "waiting" ? t("qiblaSensorWaiting")
      : sensorStatus === "live" ? t("qiblaSensorLiveHint")
      : t("qiblaManualHint");

  return (
    <section id="qibla" className="qibla-section qibla-ios mx-auto max-w-xl scroll-mt-24">
      <div className="glass-shell qibla-panel rounded-[2rem] p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-fuchsia-200">JAMIA AWQAAT</p>
            <h2 className="font-display text-2xl font-semibold" dir="auto">{t("qiblaTitle")}</h2>
          </div>
          <span className="qibla-heading-icon" aria-hidden="true"><Compass size={25}/></span>
        </div>

        <div className="qibla-ios-heading" aria-live="off">
          <span className="qibla-ios-heading-number" dir="ltr">{heading ? localizeDigits(String(heading.display), lang) + "°" : "—°"}</span>

        </div>
        <div className="qibla-dial-frame">
          <div className="qibla-vector-wrap">
            <CompassDial bearing={bearing} heading={heading} lang={lang} alt={t("qiblaTitle")} />
          </div>
        </div>

        <div className="qibla-ios-direction" role="status" dir="auto">
          <span className="qibla-ios-direction-label">{t("qiblaRotateTo")}</span>
          <strong>{relative === null ? "—" : localizeDigits(Math.round(Math.min(relative, 360 - relative)), lang) + "°"} {relative !== null && relative > 5 && relative < 355 ? (relative < 180 ? "↻" : "↺") : ""}</strong>
          {aligned && <span className="qibla-ios-aligned-dot" aria-label={t("qiblaAligned")} />}
        </div>
        <div className="qibla-data-grid">
          <div className="qibla-stat">
            <span>{t("qiblaBearing")}</span>
            <strong className="font-mono" dir="ltr">{bearing === null ? "—" : localizeDigits(bearing.toFixed(1), lang) + "°"}</strong>
            <small>{t("qiblaFromNorth")}</small>
          </div>
          <div className="qibla-stat">
            <span>{t("qiblaPhoneHeading")}</span>
            <strong className="font-mono" dir="ltr">{heading === null ? "—" : localizeDigits(String(heading.display), lang) + "°"}</strong>
            <small>{sensorStatus === "live" ? t("qiblaLive") : t("qiblaStatic")}</small>
          </div>
        </div>

        {heading?.accuracy !== undefined && (
          <p className="qibla-ios-coordinates" dir="auto">{t("qiblaSensorAccuracy")} ±{Math.round(heading.accuracy)}°</p>
        )}
        {!position && (
          <p className="qibla-note" role="status" dir="auto">
            <ShieldAlert size={16}/>{gpsFailed ? t("qiblaGpsUnavailable") : gpsLocating ? t("gpsRequest") : t("qiblaGpsRequired")}
          </p>
        )}
        <div className="qibla-actions">
          {!position && (
            <Button type="button" onClick={requestCompassPosition}
              variant="default" disabled={gpsLocating} className="qibla-gps-button rounded-xl">
              <LocateFixed size={17} className={gpsLocating ? "animate-pulse" : ""}/>
              {gpsLocating ? t("gpsRequest") : t("qiblaUseGps")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={enableSensor}
            disabled={sensorStatus === "requesting" || sensorStatus === "waiting"}
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
        {tilted && <p className="mt-3 text-center text-xs text-amber-200" role="status" dir="auto">{t("qiblaHoldFlat")}</p>}
        {unstable && (
          <p className="qibla-note" role="alert"><ShieldAlert size={16}/>{t("qiblaSensorUnstable")}</p>
        )}
      </div>
    </section>
  );
}
