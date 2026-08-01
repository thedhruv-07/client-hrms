import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Migrations run over the direct (non-pooled) connection — pgbouncer's
  // transaction-pooling mode doesn't support the DDL/advisory-lock calls
  // migrate needs. The app itself still queries through DATABASE_URL's
  // pooled connection (see src/lib/prisma.ts).
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
