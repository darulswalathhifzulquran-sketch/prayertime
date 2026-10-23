import { useEffect, useState } from "react";

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  accuracy: number; // Browser-reported uncertainty radius, in meters.
  updatedAt: number;
};

/**
 * GPS is enabled only after the visitor clicks the location button.
 * Nothing is persisted; leaving GPS mode restores the selected district.
 */
export function useDeviceLocation() {
  const [enabled, setEnabled] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState("");

  // Save only whether the visitor enabled GPS, never their coordinates.
  useEffect(() => {
    if (localStorage.getItem("kpt:gps-mode-enabled") === "true") {
      setLocating(true);
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setError("This browser cannot access GPS. Select a district instead.");
      setEnabled(false);
      localStorage.removeItem("kpt:gps-mode-enabled");
      setLocating(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            !Number.isFinite(accuracy) || Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180) {
          setError("Your device returned an invalid location. Try again.");
          setLocating(false);
          return;
        }
        setLocation({
          latitude,
          longitude,
          accuracy,
          updatedAt: position.timestamp,
        });
        setError("");
        setLocating(false);
      },
      (reason) => {
        const message = reason.code === 1
          ? "Location permission denied. Allow location access for this site in your browser, then tap the location button again."
          : reason.code === 2
            ? "GPS location unavailable. Try enabling device location services or select a district."
            : "GPS location timed out. Try again where your device can get a better fix.";
        setError(message);
        setLocating(false);
        if (reason.code === 1) {
          setLocation(null);
          setEnabled(false);
          localStorage.removeItem("kpt:gps-mode-enabled");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  const disable = () => {
    localStorage.removeItem("kpt:gps-mode-enabled");
    setEnabled(false);
    setLocating(false);
    setLocation(null);
    setError("");
  };

  const toggle = () => {
    if (enabled) {
      disable();
    } else {
      setError("");
      setLocation(null);
      setLocating(true);
      localStorage.setItem("kpt:gps-mode-enabled", "true");
      setEnabled(true);
    }
  };

  return { enabled, locating, location, error, toggle, disable };
}
