// Plain JavaScript so it runs in the production Docker image without a
// TypeScript loader. Applies every pending migration in ./drizzle.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? "postgres://app:app@localhost:5432/tabletap";
const client = postgres(url, { max: 1 });

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("Migrations applied");
await client.end();
