import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Calendar, LogIn, LogOut, ChevronDown, ChevronUp, Trash2, Clock } from "lucide-react";
import {
  useGetHistorySummary,
  getGetHistorySummaryQueryKey,
  useDeleteLocationEvent,
  getGetTodayEventsQueryKey,
  getGetWeeklySummaryQueryKey,
  getGetTotalsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function formatMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "In progress";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "h:mm a");
}

export default function History() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [deletingEvent, setDeletingEvent] = useState<{ id: number; type: string } | null>(null);

  const { data, isLoading } = useGetHistorySummary(
    { limit: 60 },
    { query: { queryKey: getGetHistorySummaryQueryKey({ limit: 60 }) } }
  );

  const deleteEvent = useDeleteLocationEvent();

  const toggleDay = (date: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deletingEvent) return;
    try {
      await deleteEvent.mutateAsync({ id: deletingEvent.id });
      toast({ title: "Event deleted" });
      queryClient.invalidateQueries({ queryKey: getGetHistorySummaryQueryKey({ limit: 60 }) });
      queryClient.invalidateQueries({ queryKey: getGetTodayEventsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWeeklySummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTotalsQueryKey() });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    } finally {
      setDeletingEvent(null);
    }
  };

  const days = data?.days ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-primary tracking-tight">History</h1>
        <p className="text-muted-foreground">All arrivals and departures, day by day.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : days.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-primary/10 p-4 rounded-full text-primary">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-medium text-foreground">No history yet</h3>
              <p className="text-muted-foreground">
                Arrivals and departures will appear here once tracking starts.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map((day, i) => {
            const dateObj = parseISO(day.date);
            const isExpanded = expandedDays.has(day.date);
            const isToday = day.date === format(new Date(), "yyyy-MM-dd");

            return (
              <Card
                key={day.date}
                className="shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300 fade-in fill-mode-both"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button
                  className="w-full text-left"
                  onClick={() => toggleDay(day.date)}
                >
                  <div className="flex items-center justify-between p-5 hover:bg-muted/20 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">
                          {format(dateObj, "EEEE, MMMM d")}
                        </h2>
                        {isToday && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">Today</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {day.firstArrival && (
                          <span>In: {formatTime(day.firstArrival)}</span>
                        )}
                        {day.lastDeparture && (
                          <span>Out: {formatTime(day.lastDeparture)}</span>
                        )}
                        {!day.firstArrival && <span>No events</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        day.totalMinutes
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {formatMinutes(day.totalMinutes)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/50 px-5 py-4 bg-muted/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 text-center text-sm mb-4">
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">First in</div>
                        <div className="font-semibold text-foreground">{formatTime(day.firstArrival)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Total time</div>
                        <div className="font-semibold text-primary">{formatMinutes(day.totalMinutes)}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider">Last out</div>
                        <div className="font-semibold text-foreground">{formatTime(day.lastDeparture)}</div>
                      </div>
                    </div>

                    {/* Individual events */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All events</p>
                    <div className="space-y-2">
                      {day.events.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 group">
                          <div className={`p-2 rounded-full shrink-0 ${
                            event.type === "arrival"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {event.type === "arrival"
                              ? <LogIn className="w-3.5 h-3.5" />
                              : <LogOut className="w-3.5 h-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground capitalize">{event.type}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {format(new Date(event.timestamp), "h:mm a")}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingEvent({ id: event.id, type: event.type })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              This will remove the {deletingEvent?.type} event permanently and may affect your daily total for that day.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingEvent(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
              {deleteEvent.isPending ? <Clock className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
