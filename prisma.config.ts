import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing DATABASE_URL (or POSTGRES_URL). Add it in Vercel Project Settings -> Environment Variables."
  );
}

export default defineConfig({
  datasource: {
    url: databaseUrl,
  },
});
