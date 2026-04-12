import { Router, type IRouter } from "express";
import { db, locationEventsTable } from "@workspace/db";
import { gte, lte, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function weekBounds() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function computeDayMinutes(events: { type: string; timestamp: Date }[]): number | null {
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const arrivals = sorted.filter(e => e.type === "arrival");
  const departures = sorted.filter(e => e.type === "departure");
  if (!arrivals.length || !departures.length) return null;
  const first = arrivals[0].timestamp;
  const last = departures[departures.length - 1].timestamp;
  if (last <= first) return null;
  return (last.getTime() - first.getTime()) / 60000;
}

router.get("/summary/week", async (req, res): Promise<void> => {
  const { weekStart, weekEnd } = weekBounds();

  const events = await db
    .select()
    .from(locationEventsTable)
    .where(
      and(
        gte(locationEventsTable.timestamp, weekStart),
        lte(locationEventsTable.timestamp, weekEnd)
      )
    )
    .orderBy(locationEventsTable.timestamp);

  const dailyMap: Record<string, typeof events> = {};
  for (const event of events) {
    const dateKey = event.timestamp.toISOString().split("T")[0];
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(event);
  }

  let totalMinutes = 0;
  const dailyBreakdown = Object.entries(dailyMap).map(([date, dayEvents]) => {
    const mins = computeDayMinutes(dayEvents) ?? 0;
    totalMinutes += mins;
    return { date, totalMinutes: mins, entries: dayEvents.length };
  }).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    daysWorked: dailyBreakdown.filter(d => d.totalMinutes > 0).length,
    dailyBreakdown,
  });
});

router.get("/summary/totals", async (req, res): Promise<void> => {
  const events = await db
    .select()
    .from(locationEventsTable)
    .orderBy(locationEventsTable.timestamp);

  const dailyMap: Record<string, typeof events> = {};
  for (const event of events) {
    const dateKey = event.timestamp.toISOString().split("T")[0];
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(event);
  }

  let totalMinutes = 0;
  let totalDays = 0;
  let totalEntries = 0;

  for (const [, dayEvents] of Object.entries(dailyMap)) {
    const mins = computeDayMinutes(dayEvents);
    if (mins !== null && mins > 0) {
      totalMinutes += mins;
      totalDays += 1;
    }
    totalEntries += dayEvents.length;
  }

  res.json({
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalDays,
    totalEntries,
    averageHoursPerDay: totalDays > 0
      ? Math.round((totalMinutes / 60 / totalDays) * 100) / 100
      : 0,
  });
});

router.get("/summary/history", async (req, res): Promise<void> => {
  const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : 30;
  const limit = isNaN(rawLimit) ? 30 : rawLimit;

  const events = await db
    .select()
    .from(locationEventsTable)
    .orderBy(desc(locationEventsTable.timestamp))
    .limit(limit * 10);

  const dailyMap: Record<string, typeof events> = {};
  for (const event of events) {
    const dateKey = event.timestamp.toISOString().split("T")[0];
    if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
    dailyMap[dateKey].push(event);
  }

  const days = Object.entries(dailyMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limit)
    .map(([date, dayEvents]) => {
      const sorted = [...dayEvents].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const arrivals = sorted.filter(e => e.type === "arrival");
      const departures = sorted.filter(e => e.type === "departure");
      const firstArrival = arrivals[0]?.timestamp ?? null;
      const lastDeparture = departures[departures.length - 1]?.timestamp ?? null;
      const totalMinutes = computeDayMinutes(sorted);
      return {
        date,
        firstArrival: firstArrival?.toISOString() ?? null,
        lastDeparture: lastDeparture?.toISOString() ?? null,
        totalMinutes,
        events: sorted,
      };
    });

  res.json({ days });
});

export default router;
