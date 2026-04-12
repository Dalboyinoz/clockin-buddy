import { Router, type IRouter } from "express";
import { db, workLocationsTable } from "@workspace/db";
import { SetWorkLocationBody } from "@workspace/api-zod";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/work-location", async (req, res): Promise<void> => {
  const [location] = await db
    .select()
    .from(workLocationsTable)
    .orderBy(desc(workLocationsTable.createdAt))
    .limit(1);

  res.json({ location: location ?? null });
});

router.put("/work-location", async (req, res): Promise<void> => {
  const parsed = SetWorkLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(workLocationsTable);

  const [location] = await db
    .insert(workLocationsTable)
    .values({
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      radiusMeters: parsed.data.radiusMeters,
    })
    .returning();

  res.json(location);
});

export default router;
