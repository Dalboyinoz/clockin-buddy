import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.clockin.timesheet",
  appName: "ClockIn Buddy",
  webDir: "dist/public",
  server: {
    url: "https://time-tracker-buddy.replit.app",
    cleartext: false,
  },
};

export default config;
