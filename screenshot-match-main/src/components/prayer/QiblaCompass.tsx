import { useEffect, useMemo, useState } from "react";
import { Compass, LocateFixed, MapPin, RotateCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localizeDigits, tr, type Lang } from "@/lib/i18n";

type Position = { lat: number; lng: number; source: "gps" | "district" | "address" };
type CompassOrientation = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionOrientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const KAABA = { lat: 21.422487, lng: 39.826206 } as const;
const radians = (n: number) => n * Math.PI / 180;
const normalize = (n: number) => ((n % 360) + 360) % 360;

/** Clockwise initial great-circle bearing to the Holy Kaaba from true north. */
export function qiblaBearing(latitude: number, longitude: number) {
  const phi = radians(latitude);
  const target = radians(KAABA.lat);
  const difference = radians(KAABA.lng - longitude);
  const east = Math.sin(difference) * Math.cos(target);
  const north = Math.cos(phi) * Math.sin(target) -
    Math.sin(phi) * Math.cos(target) * Math.cos(difference);
  return normalize(Math.atan2(east, north) * 180 / Math.PI);
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
  const [heading, setHeading] = useState<number | null>(null);
  const [sensorState, setSensorState] = useState<"idle" | "waiting" | "ready" | "unavailable" | "denied">("idle");
  const bearing = useMemo(
    () => position ? qiblaBearing(position.lat, position.lng) : null,
    [position?.lat, position?.lng],
  );
  // Only an absolute-north heading drives the live marker. Unreliable relative
  // sensor values are deliberately rejected.
  const pointerAngle = bearing === null ? null : normalize(bearing - (heading ?? 0));

  useEffect(() => {
    if (!active || !sensorEnabled) return;
    const onOrientation = (raw: DeviceOrientationEvent) => {
      const event = raw as CompassOrientation;
      let value: number | null = null;
      if (typeof event.webkitCompassHeading === "number" &&
          Number.isFinite(event.webkitCompassHeading)) {
        value = event.webkitCompassHeading;
      } else if (event.absolute === true && event.alpha !== null &&
          Number.isFinite(event.alpha)) {
        value = normalize(360 - event.alpha);
      }
      if (value === null) return;
      setHeading(normalize(value));
      setSensorState("ready");
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
    };
  }, [active, sensorEnabled]);

  useEffect(() => {
    if (!sensorEnabled || !active || sensorState !== "waiting") return;
    const timeout = window.setTimeout(
      () => setSensorState((state) => state === "waiting" ? "unavailable" : state),
      9000,
    );
    return () => window.clearTimeout(timeout);
  }, [sensorEnabled, active, sensorState]);

  const enableSensor = async () => {
    const ctor = (window as Window & { DeviceOrientationEvent?: PermissionOrientation }).DeviceOrientationEvent;
    if (!window.isSecureContext || !ctor) {
      setSensorState("unavailable");
      return;
    }
    try {
      if (typeof ctor.requestPermission === "function" &&
          await ctor.requestPermission() !== "granted") {
        setSensorState("denied");
        return;
      }
      setHeading(null);
      setSensorState("waiting");
      setSensorEnabled(true);
    } catch {
      setSensorState("denied");
    }
  };

  return (
    <section id="qibla" className="qibla-section mx-auto max-w-xl scroll-mt-24">
      <div className="glass-shell qibla-panel rounded-[2rem] p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-fuchsia-200">AWQAAT</p>
            <h2 className="font-display text-2xl font-semibold" dir="auto">{t("qiblaTitle")}</h2>
            <p className="mt-1 text-xs text-fuchsia-100/80" dir="auto">{t("qiblaSubtitle")}</p>
          </div>
          <span className="qibla-heading-icon" aria-hidden="true"><Compass size={25}/></span>
        </header>

        <div className="qibla-dial-frame">
          <div className="qibla-photo-wrap">
            <img className="qibla-photo"
              src="/images/qibla-compass.webp"
              width={400} height={400}
              alt={t("qiblaPhotoAlt")}
              draggable={false}
            />
            {pointerAngle !== null && (
              <div className="qibla-bearing-rotor"
                style={{ transform: "rotate(" + pointerAngle.toFixed(2) + "deg)" }}
                aria-hidden="true">
                <span className="qibla-bearing-tip"/>
              </div>
            )}
          </div>
          <div className="qibla-photo-legend" dir="auto">
            <span className="qibla-legend-dot"/> {t("qiblaMarkerInfo")}
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
            <strong className="font-mono" dir="ltr">{heading === null ? "—" : localizeDigits(heading.toFixed(1), lang) + "°"}</strong>
            <small>{sensorState === "ready" ? t("qiblaLive") : t("qiblaStatic")}</small>
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

        {!position && (
          <p className="qibla-note" role="status">
            <ShieldAlert size={16} aria-hidden="true"/>
            {t("qiblaLocationNeeded")}
          </p>
        )}
        {gpsError && !position && <p className="qibla-note" role="alert">{gpsError}</p>}
        <div className="qibla-actions">
          <Button type="button" onClick={onGpsClick}
            variant={gpsEnabled ? "outline" : "default"}
            disabled={gpsLocating} className="qibla-gps-button rounded-xl">
            <LocateFixed size={17} className={gpsLocating ? "animate-pulse" : ""}/>
            {gpsLocating ? t("gpsRequest") : gpsEnabled ? t("qiblaGpsOn") : t("qiblaUseGps")}
          </Button>
          <Button type="button" variant="outline" onClick={enableSensor}
            disabled={sensorState === "waiting"}
            className="qibla-sensor-button rounded-xl">
            <RotateCw size={17}/>
            {sensorState === "waiting" ? t("qiblaSensorWaiting") : t("qiblaEnableSensor")}
          </Button>
        </div>

        <p className="qibla-guidance" role="status" aria-live="polite" dir="auto">
          {sensorState === "denied" ? t("qiblaSensorDenied")
            : sensorState === "unavailable" ? t("qiblaSensorUnavailable")
            : sensorState === "waiting" ? t("qiblaSensorWaiting")
            : sensorState === "ready" ? t("qiblaSensorLiveHint")
            : t("qiblaManualHint")}
        </p>
      </div>
    </section>
  );
}
