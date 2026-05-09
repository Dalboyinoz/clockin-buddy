import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// When running as a native Capacitor app, API calls must point to the
// deployed server URL — there is no Replit shared proxy in native context.
if (Capacitor.isNativePlatform()) {
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (apiBase) {
    setBaseUrl(apiBase);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
