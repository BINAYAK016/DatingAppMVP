import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useStore } from "../lib/store";
export function NotificationListener() {
  const { token } = useStore();
  useEffect(() => {
    if (!token) return;
    const redirect = (response: Notifications.NotificationResponse) => {
      const target = response.notification.request.content.data?.url;
      if (target === "/activity" || target === "/(tabs)/chat")
        router.push(target);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      redirect(last);
      Notifications.clearLastNotificationResponse();
    }
    const listener =
      Notifications.addNotificationResponseReceivedListener(redirect);
    return () => listener.remove();
  }, [token]);
  return null;
}
