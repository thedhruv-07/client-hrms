import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authRouter } from "./routes/auth";
import { contractWorkersRouter } from "./routes/contractWorkers";
import { inHouseEmployeesRouter } from "./routes/inHouseEmployees";
import { reportsRouter } from "./routes/reports";
import { payrollRunsRouter } from "./routes/payrollRuns";
import { billsRouter } from "./routes/bills";
import { clientsRouter } from "./routes/clients";
import { companyRouter } from "./routes/company";
import { salarySlipsRouter } from "./routes/salarySlips";
import { backupRouter } from "./routes/backup";
import { docsRouter } from "./docs";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(helmet());
// CORS_ORIGIN unset -> reflect the request origin (fine for local dev with
// no deployed frontend yet); set it to a comma-separated allowlist once a
// frontend origin exists.
const corsOrigin = process.env["CORS_ORIGIN"]?.split(",");
app.use(cors({ origin: corsOrigin ?? true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/contract-workers", contractWorkersRouter);
app.use("/in-house-employees", inHouseEmployeesRouter);
app.use("/reports", reportsRouter);
app.use("/payroll-runs", payrollRunsRouter);
app.use("/bills", billsRouter);
app.use("/clients", clientsRouter);
app.use("/company", companyRouter);
app.use("/salary-slips", salarySlipsRouter);
app.use("/backup", backupRouter);
app.use("/docs", docsRouter);

app.use(errorHandler);

const port = Number(process.env["PORT"]) || 4000;
app.listen(port, () => {
  console.log(`hrms-server listening on :${port}`);
});
