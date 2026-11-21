import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, ShieldAlert, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canUsePrayerNotifications, registerPrayerServiceWorker } from "@/lib/prayer-notifications";
import { tr, type Lang } from "@/lib/i18n";
import type { AsrSchool } from "@/lib/prayer";

type Position = { lat: number; lng: number } | null;
type PushState = "idle" | "enabling" | "allowed" | "background" | "blocked" | "error";

function decodeVapidKey(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PrayerNotificationsSetup({
  lang, position, method, school,
}: {
  lang: Lang;
  position: Position;
  method: number;
  school: AsrSchool;
}) {
  const t = tr(lang);
  const [status, setStatus] = useState<PushState>("idle");
  const [ready, setReady] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [supported, setSupported] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    setSupported(canUsePrayerNotifications());
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as Navigator & {standalone?: boolean}).standalone === true;
    setInstalled(!!standalone);
    if ("Notification" in window) {
      setStatus(Notification.permission === "granted" ? "allowed" :
        Notification.permission === "denied" ? "blocked" : "idle");
    }
    void registerPrayerServiceWorker();
    void fetch("/api/push/config", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: {ready?: boolean; publicKey?: string} | null) => {
        setReady(data?.ready === true);
        setPublicKey(data?.ready && data.publicKey ? data.publicKey : "");
      }).catch(() => {
        setReady(false);
      });
  }, []);

  // This action must begin from a real user tap (Apple Web Push requirement).
  const grant = async () => {
    if (!canUsePrayerNotifications()) {
      setFeedback(t("pushUnsupported"));
      setStatus("error");
      return;
    }
    if (status === "enabling") return;
    setStatus("enabling");
    setFeedback("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "idle");
        setFeedback(permission === "denied" ? t("pushDenied") : t("pushUserAction"));
        return;
      }
      setStatus("allowed");
      const registration = await registerPrayerServiceWorker();
      if (!registration) { setFeedback(t("pushBackendMissing")); return; }
      if (!ready || !publicKey || !position || !("pushManager" in registration)) {
        setFeedback(t("pushBackendMissing"));
        return;
      }
      const sub = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setFeedback(t("pushBackendMissing"));
        return;
      }
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          // Opt-in stores only approximate (2-decimal) coordinates on the server.
          latitude: Number(position.lat.toFixed(2)),
          longitude: Number(position.lng.toFixed(2)),
          method, school, language: lang,
        }),
      });
      if (!response.ok) throw new Error("Subscription could not be saved");
      setStatus("background");
      setFeedback("");
    } catch {
      setStatus("allowed");
      setFeedback(t("pushBackendMissing"));
    }
  };

  const disable = async () => {
    const registration = await registerPrayerServiceWorker();
    if (registration && "pushManager" in registration) {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        try {
          await fetch("/api/push/subscription", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({endpoint: sub.endpoint}),
          });
        } catch {}
        await sub.unsubscribe();
      }
    }
    setStatus("allowed");
    setFeedback(t("pushUserAction"));
  };

  return (
    <section className="awqaat-push-card rounded-3xl p-4 sm:p-5" aria-label={t("pushTitle")}>
      <div className="flex items-start gap-3">
        <div className="awqaat-push-icon"><BellRing size={21} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.13em] text-blue-200">JAMIA AWQAAT</p>
          <h3 className="mt-1 text-lg font-bold text-white">{t("pushTitle")}</h3>
        </div>
      </div>
      <div className="awqaat-push-preview mt-4 flex items-center gap-3 rounded-2xl p-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#071c35] text-amber-300"><Smartphone size={19}/></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Dhuhr at 12:58</p>
          <p className="text-xs text-white/85">It's time to pray!</p>
        </div>
        <span className="text-[10px] text-blue-200">{t("pushPreview")}</span>
      </div>
      {!supported ? (
        <p className="mt-3 text-xs text-amber-200">{t("pushUnsupported")}</p>
      ) : status === "blocked" ? (
        <p className="mt-3 text-xs text-amber-200"><ShieldAlert size={14} className="mr-1 inline"/>{t("pushDenied")}</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {status === "background" ? (
            <>
              <p className="mr-auto inline-flex items-center gap-1 text-xs text-emerald-200"><CheckCircle2 size={15}/>{t("pushBackgroundActive")}</p>
              <Button variant="outline" size="sm" onClick={() => void disable()}>{t("pushDisable")}</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void grant()} disabled={status === "enabling"}>
              <BellRing className="mr-1.5 h-4 w-4" />
              {status === "enabling" ? "…" : status === "allowed" ? t("pushGranted") : t("pushPermission")}
            </Button>
          )}
        </div>
      )}
      {status !== "background" && !ready && (
        <span className="awqaat-push-availability" role="status">{t("pushForegroundOnly")}</span>
      )}
      {feedback && feedback !== t("pushBackendMissing") && feedback !== t("pushUserAction") && <p className="mt-3 text-xs text-amber-200">{feedback}</p>}
      {ready && status !== "background" && (
        <p className="mt-2 text-xs text-blue-100">{t("pushPrivacy")}</p>
      )}
      <details className="awqaat-push-details">
        <summary>{t("pushInfo")}</summary>
        <div className="mt-2 space-y-2 text-xs leading-relaxed">
          {!installed && <p>{t("pushInstallHint")}</p>}
          {!ready && <p>{t("pushBackendMissing")}</p>}
          <p>{t("pushUserAction")}</p>
          <p>{t("pushPrivacy")}</p>
          {feedback === t("pushBackendMissing") && ready && <p>{feedback}</p>}
        </div>
      </details>
    </section>
  );
}
