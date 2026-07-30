import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth";
import { contractWorkersRouter } from "./routes/contractWorkers";
import { inHouseEmployeesRouter } from "./routes/inHouseEmployees";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/contract-workers", contractWorkersRouter);
app.use("/in-house-employees", inHouseEmployeesRouter);

app.use(errorHandler);

const port = Number(process.env["PORT"]) || 4000;
app.listen(port, () => {
  console.log(`hrms-server listening on :${port}`);
});
