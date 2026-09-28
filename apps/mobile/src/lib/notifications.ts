import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
export async function enableDeviceNotifications() {
  if (Platform.OS === "web")
    throw new Error(
      "Device push is available in the Android/iOS development build. Your in-app inbox works here.",
    );
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error(
      "Remote push needs your Expo project and APNs/FCM setup. In-app updates work without it; see the beta guide.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("default", {
      name: "Connections",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error("Notifications are off. Your in-app inbox still works.");
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
