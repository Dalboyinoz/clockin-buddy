import { Router, type IRouter } from "express";
import { db, timeEntriesTable } from "@workspace/db";
import { sql, gte, lte, and, isNotNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/summary/week", async (req, res): Promise<void> => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(
      and(
        gte(timeEntriesTable.clockIn, weekStart),
        lte(timeEntriesTable.clockIn, weekEnd),
        isNotNull(timeEntriesTable.durationMinutes),
      )
    );

  let totalMinutes = 0;
  const dailyMap: Record<string, { totalMinutes: number; entries: number }> = {};

  for (const entry of entries) {
    const dateKey = entry.clockIn.toISOString().split("T")[0];
    const mins = entry.durationMinutes ?? 0;
    totalMinutes += mins;
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { totalMinutes: 0, entries: 0 };
    }
    dailyMap[dateKey].totalMinutes += mins;
    dailyMap[dateKey].entries += 1;
  }

  const dailyBreakdown = Object.entries(dailyMap).map(([date, data]) => ({
    date,
    totalMinutes: data.totalMinutes,
    entries: data.entries,
  })).sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    daysWorked: Object.keys(dailyMap).length,
    dailyBreakdown,
  });
});

router.get("/summary/totals", async (req, res): Promise<void> => {
  const entries = await db
    .select()
    .from(timeEntriesTable)
    .where(isNotNull(timeEntriesTable.durationMinutes));

  let totalMinutes = 0;
  const uniqueDays = new Set<string>();

  for (const entry of entries) {
    totalMinutes += entry.durationMinutes ?? 0;
    uniqueDays.add(entry.clockIn.toISOString().split("T")[0]);
  }

  const totalDays = uniqueDays.size;
  const totalEntries = entries.length;
  const averageHoursPerDay = totalDays > 0
    ? Math.round((totalMinutes / 60 / totalDays) * 100) / 100
    : 0;

  res.json({
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalDays,
    totalEntries,
    averageHoursPerDay,
  });
});

export default router;
