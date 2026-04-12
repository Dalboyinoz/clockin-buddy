import { Router, type IRouter } from "express";
import { eq, desc, gte, lte, and } from "drizzle-orm";
import { db, locationEventsTable } from "@workspace/db";
import {
  CreateLocationEventBody,
  DeleteLocationEventParams,
  ListLocationEventsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function dayBounds(dateStr: string) {
  const start = new Date(dateStr + "T00:00:00.000Z");
  const end = new Date(dateStr + "T23:59:59.999Z");
  return { start, end };
}

function todayBoundsLocal() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

router.get("/location-events/today", async (req, res): Promise<void> => {
  const { start, end } = todayBoundsLocal();

  const events = await db
    .select()
    .from(locationEventsTable)
    .where(
      and(
        gte(locationEventsTable.timestamp, start),
        lte(locationEventsTable.timestamp, end)
      )
    )
    .orderBy(locationEventsTable.timestamp);

  const arrivals = events.filter(e => e.type === "arrival");
  const departures = events.filter(e => e.type === "departure");

  const firstArrival = arrivals.length > 0 ? arrivals[0].timestamp : null;
  const lastDeparture = departures.length > 0 ? departures[departures.length - 1].timestamp : null;

  let totalMinutes: number | null = null;
  if (firstArrival && lastDeparture && lastDeparture > firstArrival) {
    totalMinutes = (lastDeparture.getTime() - firstArrival.getTime()) / 60000;
  }

  const lastEvent = events[events.length - 1];
  const currentlyAtWork = lastEvent?.type === "arrival";

  res.json({
    events,
    firstArrival: firstArrival?.toISOString() ?? null,
    lastDeparture: lastDeparture?.toISOString() ?? null,
    totalMinutes,
    currentlyAtWork,
  });
});

router.get("/location-events", async (req, res): Promise<void> => {
  const parsed = ListLocationEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, limit = 200 } = parsed.data;

  let events;
  if (date) {
    const { start, end } = dayBounds(date);
    events = await db
      .select()
      .from(locationEventsTable)
      .where(
        and(
          gte(locationEventsTable.timestamp, start),
          lte(locationEventsTable.timestamp, end)
        )
      )
      .orderBy(locationEventsTable.timestamp)
      .limit(limit);
  } else {
    events = await db
      .select()
      .from(locationEventsTable)
      .orderBy(desc(locationEventsTable.timestamp))
      .limit(limit);
  }

  res.json({ events });
});

router.post("/location-events", async (req, res): Promise<void> => {
  const parsed = CreateLocationEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .insert(locationEventsTable)
    .values({
      type: parsed.data.type,
      timestamp: new Date(parsed.data.timestamp),
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    })
    .returning();

  res.status(201).json(event);
});

router.delete("/location-events/:id", async (req, res): Promise<void> => {
  const params = DeleteLocationEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db
    .delete(locationEventsTable)
    .where(eq(locationEventsTable.id, params.data.id))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
