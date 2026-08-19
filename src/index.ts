export const APP_NAME = "ApplySignal";

if (import.meta.main) {
  const { createDatabase } = await import("./storage/database");
  const { createAppServer } = await import("./server");
  const db = createDatabase(process.env.APPLYSIGNAL_DB ?? "data/applysignal.db");
  Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: createAppServer(db).fetch });
  console.log(`${APP_NAME} running at http://localhost:${process.env.PORT ?? 3000}`);
}
