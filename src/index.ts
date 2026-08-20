export const APP_NAME = "ApplySignal";

if (import.meta.main) {
  const { createDatabase } = await import("./storage/database");
  const { createAppServer } = await import("./server");
  const { resolveDatabasePath } = await import("./runtime/database-path");
  const liveOnly = process.env.APPLYSIGNAL_LIVE_ONLY === "true";
  const configuredPath = process.env.APPLYSIGNAL_DB ?? "data/applysignal.db";
  const databasePath = resolveDatabasePath(configuredPath, { liveOnly });
  const db = createDatabase(databasePath);
  Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: createAppServer(db, { liveOnly }).fetch });
  console.log(`${APP_NAME} running at http://localhost:${process.env.PORT ?? 3000}`);
}
