import React from "react";
import { format, parseISO } from "date-fns";
import { Download, BarChart3, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useGetWeeklySummary,
  getGetWeeklySummaryQueryKey,
  useGetTotals,
  getGetTotalsQueryKey,
  useGetHistorySummary,
  getGetHistorySummaryQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Summary() {
  const { data: weeklySummary, isLoading: loadingWeekly } = useGetWeeklySummary({
    query: { queryKey: getGetWeeklySummaryQueryKey() },
  });

  const { data: totals, isLoading: loadingTotals } = useGetTotals({
    query: { queryKey: getGetTotalsQueryKey() },
  });

  const { data: historyData } = useGetHistorySummary(
    { limit: 200 },
    { query: { queryKey: getGetHistorySummaryQueryKey({ limit: 200 }) } }
  );

  const handleExportCSV = () => {
    const days = historyData?.days ?? [];
    if (days.length === 0) return;

    const headers = ["Date", "First Arrival", "Last Departure", "Total Hours", "Events"];
    const rows = days.map((day) => [
      day.date,
      day.firstArrival ? format(new Date(day.firstArrival), "HH:mm") : "",
      day.lastDeparture ? format(new Date(day.lastDeparture), "HH:mm") : "",
      day.totalMinutes !== null ? (day.totalMinutes / 60).toFixed(2) : "",
      day.events.map(e => `${e.type} ${format(new Date(e.timestamp), "HH:mm")}`).join("; "),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const chartData = weeklySummary?.dailyBreakdown.map(day => ({
    name: format(parseISO(day.date), "EEE"),
    hours: Number((day.totalMinutes / 60).toFixed(1)),
    fullDate: format(parseISO(day.date), "MMM d, yyyy"),
  })) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-serif text-primary tracking-tight">Summary</h1>
          <p className="text-muted-foreground">Hours tracked from first arrival to last departure each day.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="shrink-0 shadow-sm">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Hours</div>
              <div className="text-2xl font-serif font-semibold text-foreground">
                {loadingTotals ? <Skeleton className="h-8 w-16 mt-1" /> : totals?.totalHours ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-secondary p-3 rounded-xl text-secondary-foreground">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Days Worked</div>
              <div className="text-2xl font-serif font-semibold text-foreground">
                {loadingTotals ? <Skeleton className="h-8 w-16 mt-1" /> : totals?.totalDays ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-primary p-3 rounded-xl text-primary-foreground">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Avg. Hrs/Day</div>
              <div className="text-2xl font-serif font-semibold text-foreground">
                {loadingTotals ? <Skeleton className="h-8 w-16 mt-1" /> : totals?.averageHoursPerDay?.toFixed(1) ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-muted p-3 rounded-xl text-muted-foreground">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Location Events</div>
              <div className="text-2xl font-serif font-semibold text-foreground">
                {loadingTotals ? <Skeleton className="h-8 w-16 mt-1" /> : totals?.totalEntries ?? 0}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-border/60 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-6">
          <CardTitle className="font-serif text-xl">Weekly Breakdown</CardTitle>
          <CardDescription>
            {weeklySummary ? (
              <>Week of {format(parseISO(weeklySummary.weekStart), "MMMM d")} – {format(parseISO(weeklySummary.weekEnd), "MMMM d, yyyy")}</>
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loadingWeekly ? (
            <div className="h-[300px] flex items-end justify-between px-4 gap-2">
              {[1,2,3,4,5,6,7].map(i => (
                <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${30 + i * 10}%` }} />
              ))}
            </div>
          ) : chartData.length > 0 && chartData.some(d => d.hours > 0) ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground shadow-lg border border-border p-3 rounded-lg flex flex-col gap-1">
                            <span className="text-sm font-medium">{payload[0].payload.fullDate}</span>
                            <span className="text-primary font-bold">{payload[0].value} hours</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} animationDuration={1200}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.hours > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground flex-col gap-2">
              <BarChart3 className="w-12 h-12 opacity-20" />
              <p>No tracked hours this week.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
