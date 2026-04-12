import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, MapPin, Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetActiveEntry, getGetActiveEntryQueryKey, useCreateTimeEntry, useUpdateTimeEntry, useGetTotals, getGetTotalsQueryKey, useGetWorkLocation, getGetWorkLocationQueryKey, useGetWeeklySummary, getGetWeeklySummaryQueryKey } from "@workspace/api-client-react";
import { getCurrentLocation, getDistance } from "@/lib/location";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: activeEntryData, isLoading: loadingActive } = useGetActiveEntry({ query: { queryKey: getGetActiveEntryQueryKey() } });
  const { data: totalsData, isLoading: loadingTotals } = useGetTotals({ query: { queryKey: getGetTotalsQueryKey() } });
  const { data: workLocationData } = useGetWorkLocation({ query: { queryKey: getGetWorkLocationQueryKey() } });
  const { data: weeklySummaryData } = useGetWeeklySummary({ query: { queryKey: getGetWeeklySummaryQueryKey() } });
  
  const createEntry = useCreateTimeEntry();
  const updateEntry = useUpdateTimeEntry();

  const [locationStatus, setLocationStatus] = useState<"checking" | "at-work" | "away" | "error">("checking");
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const activeEntry = activeEntryData?.entry;
  const isClockedIn = !!activeEntry;

  useEffect(() => {
    async function checkLocation() {
      if (!workLocationData?.location) {
        setLocationStatus("error");
        return;
      }
      
      try {
        const pos = await getCurrentLocation();
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        
        const dist = getDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          workLocationData.location.latitude,
          workLocationData.location.longitude
        );
        
        if (dist <= workLocationData.location.radiusMeters) {
          setLocationStatus("at-work");
        } else {
          setLocationStatus("away");
        }
      } catch (err) {
        setLocationStatus("error");
      }
    }
    
    checkLocation();
  }, [workLocationData]);

  const handleClockAction = async () => {
    if (isClockedIn) {
      // Clock out
      try {
        await updateEntry.mutateAsync({
          id: activeEntry.id,
          data: {
            clockOut: new Date().toISOString(),
            latitude: currentLocation?.lat,
            longitude: currentLocation?.lng,
          }
        });
        toast({ title: "Clocked out successfully", description: "Your time has been recorded." });
        queryClient.invalidateQueries({ queryKey: getGetActiveEntryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTotalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeeklySummaryQueryKey() });
      } catch (err) {
        toast({ title: "Failed to clock out", variant: "destructive" });
      }
    } else {
      // Clock in
      try {
        await createEntry.mutateAsync({
          data: {
            clockIn: new Date().toISOString(),
            latitude: currentLocation?.lat,
            longitude: currentLocation?.lng,
          }
        });
        toast({ title: "Clocked in successfully", description: "Have a great day!" });
        queryClient.invalidateQueries({ queryKey: getGetActiveEntryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTotalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeeklySummaryQueryKey() });
      } catch (err) {
        toast({ title: "Failed to clock in", variant: "destructive" });
      }
    }
  };

  const isPending = createEntry.isPending || updateEntry.isPending;
  const todayTotalMinutes = weeklySummaryData?.dailyBreakdown.find(d => d.date === format(new Date(), 'yyyy-MM-dd'))?.totalMinutes || 0;
  const todayHours = Math.floor(todayTotalMinutes / 60);
  const todayMins = todayTotalMinutes % 60;

  return (
    <div className="max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-primary tracking-tight">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}</h1>
        <p className="text-muted-foreground text-lg">Ready to track your time?</p>
      </div>

      <Card className="border-none shadow-xl bg-gradient-to-br from-card to-card/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Clock className="w-48 h-48" />
        </div>
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-8 relative z-10">
          <div className="space-y-1 text-center">
            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</div>
            {loadingActive ? (
              <Skeleton className="h-8 w-32 mx-auto" />
            ) : (
              <div className={`text-2xl font-semibold flex items-center gap-2 ${isClockedIn ? 'text-primary' : 'text-muted-foreground'}`}>
                {isClockedIn ? (
                  <>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    Clocked In
                  </>
                ) : (
                  <>Clocked Out</>
                )}
              </div>
            )}
            
            {isClockedIn && activeEntry && (
              <div className="text-sm text-muted-foreground mt-2">
                Since {format(new Date(activeEntry.clockIn), 'h:mm a')}
              </div>
            )}
          </div>

          <Button 
            onClick={handleClockAction}
            disabled={isPending || loadingActive}
            size="lg"
            className={`w-48 h-48 rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
              isClockedIn 
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' 
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {isPending ? (
              <Loader2 className="w-12 h-12 animate-spin" />
            ) : isClockedIn ? (
              <div className="flex flex-col items-center gap-2">
                <Square className="w-12 h-12 fill-current" />
                <span className="text-lg font-medium">Clock Out</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Play className="w-12 h-12 fill-current ml-2" />
                <span className="text-lg font-medium">Clock In</span>
              </div>
            )}
          </Button>

          {workLocationData?.location && (
            <div className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-muted/50 border border-border">
              <MapPin className={`w-4 h-4 ${locationStatus === 'at-work' ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="font-medium text-foreground">
                {locationStatus === 'checking' && "Checking location..."}
                {locationStatus === 'at-work' && `You're at ${workLocationData.location.name}`}
                {locationStatus === 'away' && `Away from ${workLocationData.location.name}`}
                {locationStatus === 'error' && "Location unavailable"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground mb-1">Today</div>
            <div className="text-2xl font-serif font-medium text-foreground">
              {todayHours}h {todayMins}m
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50 bg-primary/5">
          <CardContent className="p-5">
            <div className="text-sm text-primary/80 mb-1">This Week</div>
            <div className="text-2xl font-serif font-medium text-primary">
              {loadingTotals ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                `${totalsData?.totalHours || 0}h ${totalsData?.totalMinutes ? totalsData.totalMinutes % 60 : 0}m`
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
