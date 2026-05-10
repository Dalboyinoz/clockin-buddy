import { Router, type IRouter } from "express";
import { db, workLocationsTable } from "@workspace/db";
import { SetWorkLocationBody } from "@workspace/api-zod";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/work-location", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const [location] = await db
    .select()
    .from(workLocationsTable)
    .where(eq(workLocationsTable.userId, userId))
    .orderBy(desc(workLocationsTable.createdAt))
    .limit(1);

  res.json({ location: location ?? null });
});

router.put("/work-location", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as any).userId as string;
  const parsed = SetWorkLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db.delete(workLocationsTable).where(eq(workLocationsTable.userId, userId));

  const [location] = await db
    .insert(workLocationsTable)
    .values({
      userId,
      name: parsed.data.name,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      radiusMeters: parsed.data.radiusMeters,
    })
    .returning();

  res.json(location);
});

export default router;
