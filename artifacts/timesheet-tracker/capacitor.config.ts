import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.clockin.timesheet",
  appName: "ClockIn Buddy",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
