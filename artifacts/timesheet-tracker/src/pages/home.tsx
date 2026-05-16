import React, { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { Clock, LogIn, LogOut, AlertCircle, Navigation, Zap } from "lucide-react";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Inline types for @capacitor-community/background-geolocation (native-only, no JS dist)
interface BGLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  simulated: boolean;
  bearing: number | null;
  speed: number | null;
  time: number | null;
}
interface CallbackError extends Error { code?: string; }
interface BackgroundGeolocationPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (position?: BGLocation, error?: CallbackError) => void
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
}

// Module-level singleton — registerPlugin must only be called once
let _bgGeo: BackgroundGeolocationPlugin | null = null;
function getBgGeo(): BackgroundGeolocationPlugin {
  if (!_bgGeo) _bgGeo = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  return _bgGeo;
}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetTodayEvents,
  getGetTodayEventsQueryKey,
  useCreateLocationEvent,
  useGetWorkLocation,
  getGetWorkLocationQueryKey,
  useGetWeeklySummary,
  getGetWeeklySummaryQueryKey,
} from "@workspace/api-client-react";
import { getDistance } from "@/lib/location";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between same-type events

type GeofenceState = "inside" | "outside" | "unknown";

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "h:mm a");
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: todayData, isLoading: loadingToday } = useGetTodayEvents({
    query: { queryKey: getGetTodayEventsQueryKey(), refetchInterval: 60000 },
  });
  const { data: workLocationData } = useGetWorkLocation({
    query: { queryKey: getGetWorkLocationQueryKey() },
  });
  const { data: weeklySummary } = useGetWeeklySummary({
    query: { queryKey: getGetWeeklySummaryQueryKey() },
  });

  const createEvent = useCreateLocationEvent();

  const geofenceStateRef = useRef<GeofenceState>(
    (localStorage.getItem("geofence_state") as GeofenceState) ?? "unknown"
  );
  const outsideCountRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const recordingRef = useRef(false);
  // Cooldown: prevent the same event type firing more than once per 5 minutes
  const lastEventRef = useRef<{ type: string; time: number }>({
    type: localStorage.getItem("last_event_type") ?? "",
    time: Number(localStorage.getItem("last_event_time") ?? 0),
  });

  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [liveMinutes, setLiveMinutes] = useState<number | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Request notification permission once on mount (native only)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    LocalNotifications.requestPermissions().catch(() => {});
  }, []);

  useEffect(() => {
    let released = false;

    const acquireWakeLock = async () => {
      try {
        const { isSupported } = await KeepAwake.isSupported();
        if (!isSupported) return;
        await KeepAwake.keepAwake();
        if (!released) setWakeLockActive(true);
      } catch {
        // silently ignore — non-critical
      }
    };

    acquireWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      KeepAwake.allowSleep().catch(() => {});
    };
  }, []);

  const recordEvent = useCallback(
    async (type: "arrival" | "departure", lat: number, lng: number) => {
      if (recordingRef.current) return;
      // Skip if the same event type fired within the cooldown window
      const now = Date.now();
      if (lastEventRef.current.type === type && now - lastEventRef.current.time < COOLDOWN_MS) return;
      recordingRef.current = true;
      lastEventRef.current = { type, time: now };
      localStorage.setItem("last_event_type", type);
      localStorage.setItem("last_event_time", String(now));
      try {
        await createEvent.mutateAsync({
          data: { type, timestamp: new Date().toISOString(), latitude: lat, longitude: lng },
        });
        queryClient.invalidateQueries({ queryKey: getGetTodayEventsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeeklySummaryQueryKey() });
        toast({
          title: type === "arrival" ? "Arrived at work" : "Left work",
          description: type === "arrival"
            ? "Your arrival has been recorded automatically."
            : "Your departure has been recorded automatically.",
        });
        // Send a local notification so the user knows tracking fired
        if (Capacitor.isNativePlatform()) {
          const now = new Date();
          const timeStr = format(now, "h:mm a");
          await LocalNotifications.schedule({
            notifications: [{
              id: Date.now(),
              title: type === "arrival" ? "Clocked in" : "Clocked out",
              body: type === "arrival"
                ? `Arrival recorded at ${timeStr}`
                : `Departure recorded at ${timeStr}`,
              smallIcon: "ic_stat_icon_config_sample",
              sound: undefined,
            }],
          }).catch(() => {});
        }
      } catch {
        // silently fail — will retry on next position update
      } finally {
        recordingRef.current = false;
      }
    },
    [createEvent, queryClient, toast]
  );

  useEffect(() => {
    const loc = workLocationData?.location;
    if (!loc) {
      setLocationPermission("denied");
      return;
    }

    const handleCoords = (latitude: number, longitude: number) => {
      setLocationPermission("granted");
      const dist = getDistance(latitude, longitude, loc.latitude, loc.longitude);
      setCurrentDistance(Math.round(dist));
      const isInside = dist <= loc.radiusMeters;
      const prevState = geofenceStateRef.current;

      if (isInside) {
        outsideCountRef.current = 0;
        if (prevState !== "inside") {
          geofenceStateRef.current = "inside";
          localStorage.setItem("geofence_state", "inside");
          recordEvent("arrival", latitude, longitude);
        }
      } else {
        if (prevState === "inside") {
          outsideCountRef.current += 1;
          if (outsideCountRef.current >= 3) {
            geofenceStateRef.current = "outside";
            localStorage.setItem("geofence_state", "outside");
            outsideCountRef.current = 0;
            recordEvent("departure", latitude, longitude);
          }
        } else if (prevState === "unknown") {
          geofenceStateRef.current = "outside";
          localStorage.setItem("geofence_state", "outside");
        }
      }
    };

    let cleanupFn: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      // Native: use background geolocation foreground service so GPS keeps
      // running when the app is minimised.
      let watcherId: string | null = null;
      getBgGeo().addWatcher(
        {
          backgroundMessage: "ClockIn Buddy is monitoring your location to detect work arrivals and departures.",
          backgroundTitle: "Work location tracking active",
          requestPermissions: true,
          stale: false,
          distanceFilter: 15,
        },
        (location: BGLocation | undefined, error: CallbackError | undefined) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") setLocationPermission("denied");
            return;
          }
          if (location) handleCoords(location.latitude, location.longitude);
        }
      ).then((id: string) => { watcherId = id; });

      cleanupFn = () => {
        if (watcherId) getBgGeo().removeWatcher({ id: watcherId });
      };
    } else {
      // Web fallback: use browser geolocation API.
      if (!navigator.geolocation) {
        setLocationPermission("denied");
        return;
      }
      const id = navigator.geolocation.watchPosition(
        (pos) => handleCoords(pos.coords.latitude, pos.coords.longitude),
        () => setLocationPermission("denied"),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
      cleanupFn = () => navigator.geolocation.clearWatch(id);
    }

    return () => cleanupFn?.();
  }, [workLocationData, recordEvent]);

  // Live running timer
  useEffect(() => {
    if (!todayData?.firstArrival) {
      setLiveMinutes(null);
      return;
    }

    const tick = () => {
      const now = new Date();
      const ref = todayData.lastDeparture
        ? new Date(todayData.lastDeparture)
        : now;
      const first = new Date(todayData.firstArrival!);
      setLiveMinutes((ref.getTime() - first.getTime()) / 60000);
    };

    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [todayData]);

  const currentlyAtWork = todayData?.currentlyAtWork ?? false;
  const firstArrival = todayData?.firstArrival;
  const lastDeparture = todayData?.lastDeparture;
  const eventCount = todayData?.events?.length ?? 0;

  const weekTotal = weeklySummary
    ? `${weeklySummary.totalHours}h`
    : "—";

  const workLoc = workLocationData?.location;

  return (
    <div className="max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-1">
        <h1 className="text-3xl font-serif text-primary tracking-tight">
          {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"}
        </h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      {/* Main status card */}
      <Card className="border-none shadow-xl overflow-hidden relative bg-gradient-to-br from-card to-card/60">
        <div className="absolute top-0 right-0 p-4 opacity-[0.04] pointer-events-none">
          <Clock className="w-48 h-48" />
        </div>
        <CardContent className="p-8 space-y-6 relative z-10">
          {/* Status pill */}
          <div className="flex items-center justify-center">
            {loadingToday ? (
              <Skeleton className="h-9 w-36 rounded-full" />
            ) : (
              <div className={`flex items-center gap-2.5 px-5 py-2 rounded-full text-sm font-semibold border ${
                currentlyAtWork
                  ? "bg-primary/10 text-primary border-primary/20"
                  : eventCount > 0
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-muted/50 text-muted-foreground border-border/50"
              }`}>
                {currentlyAtWork && (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                )}
                {currentlyAtWork ? "At work" : eventCount > 0 ? "Off site" : "Not started"}
              </div>
            )}
          </div>

          {/* Big time display */}
          <div className="text-center space-y-1">
            {loadingToday ? (
              <Skeleton className="h-16 w-48 mx-auto" />
            ) : (
              <div className="text-6xl font-serif font-semibold text-foreground tracking-tight">
                {formatMinutes(liveMinutes)}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {firstArrival && lastDeparture
                ? `${formatTime(firstArrival)} — ${formatTime(lastDeparture)}`
                : firstArrival
                ? `Started at ${formatTime(firstArrival)}`
                : "No activity yet today"}
            </div>
          </div>

          {/* Event timeline */}
          {!loadingToday && eventCount > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's visits</p>
              <div className="space-y-1.5">
                {todayData?.events?.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 text-sm">
                    <div className={`p-1.5 rounded-full ${event.type === "arrival" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {event.type === "arrival"
                        ? <LogIn className="w-3 h-3" />
                        : <LogOut className="w-3 h-3" />}
                    </div>
                    <span className="capitalize font-medium text-foreground">{event.type}</span>
                    <span className="text-muted-foreground ml-auto">{formatTime(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location monitoring status */}
      <Card className="shadow-sm border-border/50">
        <CardContent className="p-4">
          {!workLoc ? (
            <div className="flex items-start gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">No work location set</p>
                <p className="text-muted-foreground text-xs mt-0.5">Go to the Location tab to set your workplace so tracking can start automatically.</p>
              </div>
            </div>
          ) : locationPermission === "denied" ? (
            <div className="flex items-start gap-3 text-sm">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Location access required</p>
                <p className="text-muted-foreground text-xs mt-0.5">Allow location access in your browser so ClockIn Buddy can detect arrivals and departures automatically.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <div className={`p-2 rounded-full ${currentlyAtWork ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {currentlyAtWork ? `At ${workLoc.name}` : `Away from ${workLoc.name}`}
                  </p>
                  {currentDistance !== null && (
                    <p className="text-xs text-muted-foreground">
                      {currentDistance < 1000
                        ? `${currentDistance}m away`
                        : `${(currentDistance / 1000).toFixed(1)}km away`}
                      {" · "}{workLoc.radiusMeters}m radius
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Auto
                </Badge>
                {wakeLockActive && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium">
                    <Zap className="w-3 h-3" />
                    Screen on
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Today</div>
            <div className="text-2xl font-serif font-semibold text-foreground">
              {loadingToday ? <Skeleton className="h-7 w-20 mt-1" /> : formatMinutes(liveMinutes)}
            </div>
            {firstArrival && (
              <div className="text-xs text-muted-foreground mt-1">
                {eventCount} event{eventCount !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50 bg-primary/5">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-primary/70 uppercase tracking-wider mb-1">This Week</div>
            <div className="text-2xl font-serif font-semibold text-primary">{weekTotal}</div>
            {weeklySummary && (
              <div className="text-xs text-primary/70 mt-1">
                {weeklySummary.daysWorked} day{weeklySummary.daysWorked !== 1 ? "s" : ""}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
