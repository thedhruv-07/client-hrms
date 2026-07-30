import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

// Fixture values taken verbatim from PROJECT_SPEC.md section 7 (the real
// source workbook) — used as regression baseline once the calc engine lands.
const WORKERS = [
  { code: "CW-001", name: "Arun", basicSalary: 17000, workingDays: 23, otHours: 58, grossEarning: 17141.67, totalDeduction: 162.85, advance: 1000, netPayable: 15978.82 },
  { code: "CW-002", name: "Biru Kumar", basicSalary: 17000, workingDays: 18, otHours: 51, grossEarning: 13812.50, totalDeduction: 131.22, advance: 5000, netPayable: 8681.28 },
  { code: "CW-003", name: "Suraj", basicSalary: 17000, workingDays: 3, otHours: 1, grossEarning: 1770.83, totalDeduction: 16.82, advance: 0, netPayable: 1754.01 },
];

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "seed-company" },
    update: {},
    create: {
      id: "seed-company",
      name: "Lucky Enterprises",
      address: "Contractor address, to be filled in",
      gstNo: null,
      panNo: null,
      pfCode: null,
      esiCode: null,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client" },
    update: {},
    create: {
      id: "seed-client",
      name: "Wide India Industries",
      address: "Client address, to be filled in",
    },
  });

  const passwordHash = await bcrypt.hash("changeme123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash,
      name: "Admin",
      role: "ADMIN",
    },
  });

  const payrollRun = await prisma.payrollRun.upsert({
    where: { month_year_type: { month: 6, year: 2026, type: "CONTRACT" } },
    update: {},
    create: {
      month: 6,
      year: 2026,
      type: "CONTRACT",
      status: "FINALIZED",
      createdById: admin.id,
    },
  });

  for (const w of WORKERS) {
    const worker = await prisma.contractWorker.upsert({
      where: { code: w.code },
      update: {},
      create: {
        code: w.code,
        name: w.name,
        basicSalary: w.basicSalary,
      },
    });

    const basicEarn = Math.round(((w.basicSalary / 30) * w.workingDays) * 100) / 100;
    const otAmount = Math.round(((w.basicSalary / 30 / 8) * w.otHours) * 100) / 100;

    await prisma.payrollLine.create({
      data: {
        payrollRunId: payrollRun.id,
        contractWorkerId: worker.id,
        workingDays: w.workingDays,
        otHours: w.otHours,
        basicEarn,
        otAmount,
        grossEarning: w.grossEarning,
        pf: 0,
        esic: Math.round((w.grossEarning * 0.75) / 100 * 100) / 100,
        lwf: Math.round((w.grossEarning * 0.2) / 100 * 100) / 100,
        advance: w.advance,
        totalDeduction: w.totalDeduction,
        netPayable: w.netPayable,
      },
    });
  }

  console.log(`Seeded company=${company.name} client=${client.name} admin=${admin.email} workers=${WORKERS.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
