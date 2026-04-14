import { useState, useEffect, useCallback } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushStatus = "unsupported" | "denied" | "prompt" | "subscribed" | "loading";

export function usePushNotifications(token: string | null, apiBase: string) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscription, setSubscription] = useState<PushSubscriptionJSON | null>(null);

  const isSupported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;

  const checkStatus = useCallback(async () => {
    if (!isSupported) { setStatus("unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setSubscription(sub.toJSON());
        setStatus("subscribed");
      } else {
        setStatus("prompt");
      }
    } catch {
      setStatus("prompt");
    }
  }, [isSupported]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !token) return false;
    setStatus("loading");
    try {
      const permResult = await Notification.requestPermission();
      if (permResult !== "granted") { setStatus("denied"); return false; }

      const vapidRes = await fetch(`${apiBase}/api/push/vapid-key`);
      const { publicKey } = await vapidRes.json();

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await fetch(`${apiBase}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      setSubscription(sub.toJSON());
      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("subscribe error", err);
      setStatus("prompt");
      return false;
    }
  }, [isSupported, token, apiBase]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !token) return false;
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(`${apiBase}/api/push/subscribe`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscription(null);
      setStatus("prompt");
      return true;
    } catch (err) {
      console.error("unsubscribe error", err);
      setStatus("subscribed");
      return false;
    }
  }, [isSupported, token, apiBase]);

  return { status, subscription, subscribe, unsubscribe, isSupported };
}
