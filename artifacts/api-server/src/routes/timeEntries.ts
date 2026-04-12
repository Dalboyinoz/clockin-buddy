import { Router, type IRouter } from "express";
import { eq, desc, isNull } from "drizzle-orm";
import { db, timeEntriesTable } from "@workspace/db";
import {
  CreateTimeEntryBody,
  UpdateTimeEntryBody,
  UpdateTimeEntryParams,
  GetTimeEntryParams,
  DeleteTimeEntryParams,
  ListTimeEntriesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/time-entries/active", async (req, res): Promise<void> => {
  const [entry] = await db
    .select()
    .from(timeEntriesTable)
    .where(isNull(timeEntriesTable.clockOut))
    .orderBy(desc(timeEntriesTable.clockIn))
    .limit(1);

  res.json({ entry: entry ?? null });
});

router.get("/time-entries", async (req, res): Promise<void> => {
  const parsed = ListTimeEntriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0 } = parsed.data;

  const entries = await db
    .select()
    .from(timeEntriesTable)
    .orderBy(desc(timeEntriesTable.clockIn))
    .limit(limit)
    .offset(offset);

  const countResult = await db.$count(timeEntriesTable);
  const total = Number(countResult);

  res.json({ entries, total });
});

router.post("/time-entries", async (req, res): Promise<void> => {
  const parsed = CreateTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db
    .insert(timeEntriesTable)
    .values({
      clockIn: new Date(parsed.data.clockIn),
      notes: parsed.data.notes ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    })
    .returning();

  res.status(201).json(entry);
});

router.get("/time-entries/:id", async (req, res): Promise<void> => {
  const params = GetTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .select()
    .from(timeEntriesTable)
    .where(eq(timeEntriesTable.id, params.data.id));

  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }

  res.json(entry);
});

router.patch("/time-entries/:id", async (req, res): Promise<void> => {
  const params = UpdateTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTimeEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.clockOut !== undefined) {
    const clockOutDate = new Date(parsed.data.clockOut);
    updates.clockOut = clockOutDate;

    const [existing] = await db
      .select()
      .from(timeEntriesTable)
      .where(eq(timeEntriesTable.id, params.data.id));

    if (existing) {
      const durationMs = clockOutDate.getTime() - existing.clockIn.getTime();
      updates.durationMinutes = durationMs / 60000;
    }
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes;
  }
  if (parsed.data.latitude !== undefined) {
    updates.latitude = parsed.data.latitude;
  }
  if (parsed.data.longitude !== undefined) {
    updates.longitude = parsed.data.longitude;
  }

  const [entry] = await db
    .update(timeEntriesTable)
    .set(updates)
    .where(eq(timeEntriesTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }

  res.json(entry);
});

router.delete("/time-entries/:id", async (req, res): Promise<void> => {
  const params = DeleteTimeEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db
    .delete(timeEntriesTable)
    .where(eq(timeEntriesTable.id, params.data.id))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
