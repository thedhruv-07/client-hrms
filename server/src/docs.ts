import { Router } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import path from "node:path";

// swagger-jsdoc's glob matching needs forward slashes even on Windows;
// path.join here would otherwise produce backslash-separated paths that
// silently match zero files.
function globPath(...segments: string[]): string {
  return path.join(...segments).split(path.sep).join("/");
}

const spec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "HRMS — Payroll & Contract-Labour Billing API",
      version: "1.0.0",
      description:
        "Contract labour wage register + client GST billing, and in-house employee payroll. " +
        "All routes except /auth/login require a Bearer JWT (see /auth/login).",
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { description: "String message, or a zod field-error object" } },
        },
        ContractWorker: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            basicSalary: { type: "string", description: "Decimal, serialized as a string" },
            bankAccount: { type: "string", nullable: true },
            ifsc: { type: "string", nullable: true },
            pfNo: { type: "string", nullable: true },
            esicNo: { type: "string", nullable: true },
            uan: { type: "string", nullable: true },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
          },
        },
        InHouseEmployee: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            name: { type: "string" },
            basicSalary: { type: "string", description: "Decimal, serialized as a string" },
            department: { type: "string" },
            designation: { type: "string" },
            joiningDate: { type: "string", format: "date-time" },
            leaveBalance: { type: "string", description: "Decimal, serialized as a string" },
            bankAccount: { type: "string", nullable: true },
            ifsc: { type: "string", nullable: true },
            pfNo: { type: "string", nullable: true },
            esicNo: { type: "string", nullable: true },
            uan: { type: "string", nullable: true },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
          },
        },
        ImportResult: {
          type: "object",
          properties: {
            created: { type: "integer" },
            total: { type: "integer" },
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  row: { type: "integer", description: "1-indexed CSV row, header is row 1" },
                  code: { type: "string" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [globPath(__dirname, "routes", "*.ts"), globPath(__dirname, "routes", "*.js")],
});

export const docsRouter = Router();
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(spec));
