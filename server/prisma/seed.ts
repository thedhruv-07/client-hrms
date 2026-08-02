import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { calculateInHouseWageLine } from "../src/engine/inhousePayroll";
import { calculateWageLine } from "../src/engine/wage";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

// Input values taken verbatim from PROJECT_SPEC.md section 7 (the real source
// workbook, a 30-day June). Wage figures are computed via the real engine
// below (not hard-coded), so a 31-day month like July correctly pays a lower
// per-day rate instead of silently reusing June's 30-day numbers.
const WORKERS = [
  { code: "CW-001", name: "Arun", basicSalary: 17000, workingDays: 23, otHours: 58, advance: 1000 },
  { code: "CW-002", name: "Biru Kumar", basicSalary: 17000, workingDays: 18, otHours: 51, advance: 5000 },
  { code: "CW-003", name: "Suraj", basicSalary: 17000, workingDays: 3, otHours: 1, advance: 0 },
];

// A second client demonstrates the multi-client structure — its own workers and its own wage register.
const CLIENT2_WORKERS = [
  { code: "CW-101", name: "Deepak", basicSalary: 16000, workingDays: 25, otHours: 20, advance: 0 },
  { code: "CW-102", name: "Manoj", basicSalary: 16000, workingDays: 22, otHours: 10, advance: 2000 },
];

const EMPLOYEES = [
  {
    code: "IH-001",
    name: "Priya Sharma",
    fatherHusbandName: "Rajesh Sharma",
    basicSalary: 45000,
    department: "Engineering",
    designation: "Software Engineer",
    joiningDate: "2024-03-01",
    paymentMode: "Bank Transfer",
    bankAccount: "50100123456789",
    ifsc: "HDFC0001234",
    pfNo: "PF-45001",
    esicNo: "ESIC-77001",
    uan: "100123456789",
    unpaidLeaveDays: 1,
    bonus: 0,
    incentive: 2000,
  },
  {
    code: "IH-002",
    name: "Rohit Verma",
    fatherHusbandName: "Suresh Verma",
    basicSalary: 32000,
    department: "Operations",
    designation: "Operations Executive",
    joiningDate: "2023-07-15",
    paymentMode: "Bank Transfer",
    bankAccount: "50100987654321",
    ifsc: "ICIC0005678",
    pfNo: "PF-45002",
    esicNo: "ESIC-77002",
    uan: "100987654321",
    unpaidLeaveDays: 0,
    bonus: 1000,
    incentive: 0,
  },
  {
    code: "IH-003",
    name: "Anjali Mehta",
    fatherHusbandName: "Kishore Mehta",
    basicSalary: 28000,
    department: "Finance",
    designation: "Accountant",
    joiningDate: "2024-01-10",
    paymentMode: "Bank Transfer",
    bankAccount: "50100456789123",
    ifsc: "SBIN0009876",
    pfNo: "PF-45003",
    esicNo: "ESIC-77003",
    uan: "100456789123",
    unpaidLeaveDays: 2,
    bonus: 0,
    incentive: 0,
  },
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

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      name: "OMP India Pvt. Limited",
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

  async function seedContractRun(month: number, year: number, status: "DRAFT" | "FINALIZED", clientId: string, workers: typeof WORKERS) {
    const run = await prisma.payrollRun.upsert({
      where: { month_year_type_clientId: { month, year, type: "CONTRACT", clientId } },
      update: {},
      create: { month, year, type: "CONTRACT", status, clientId, createdById: admin.id },
    });

    const hasLines = (await prisma.payrollLine.count({ where: { payrollRunId: run.id } })) > 0;
    if (hasLines) return run;

    const monthDays = new Date(year, month, 0).getDate();
    for (const w of workers) {
      const worker = await prisma.contractWorker.upsert({
        where: { code: w.code },
        update: {},
        create: { code: w.code, name: w.name, basicSalary: w.basicSalary, clientId },
      });

      const result = calculateWageLine({ basicSalary: w.basicSalary, monthDays, workingDays: w.workingDays, otHours: w.otHours, advance: w.advance });

      await prisma.payrollLine.create({
        data: {
          payrollRunId: run.id,
          contractWorkerId: worker.id,
          workingDays: w.workingDays,
          otHours: w.otHours,
          basicEarn: result.basicEarn,
          otAmount: result.otAmount,
          grossEarning: result.grossEarning,
          pf: result.pf,
          esic: result.esic,
          lwf: result.lwf,
          advance: result.advance,
          totalDeduction: result.totalDeduction,
          netPayable: result.netPayable,
        },
      });
    }
    return run;
  }

  // June: finalized, already billable. July: this month's open run, no bill yet.
  await seedContractRun(6, 2026, "FINALIZED", client.id, WORKERS);
  await seedContractRun(7, 2026, "DRAFT", client.id, WORKERS);

  // Second client's own, independent wage register for the same period.
  await seedContractRun(7, 2026, "DRAFT", client2.id, CLIENT2_WORKERS);

  async function seedInHouseRun(month: number, year: number, status: "DRAFT" | "FINALIZED") {
    // clientId is always null for INHOUSE runs, and Postgres treats each NULL in a unique
    // index as distinct, so the compound key can't be used to find-or-create here — look up
    // by the non-client fields instead.
    const run =
      (await prisma.payrollRun.findFirst({ where: { month, year, type: "INHOUSE" } })) ??
      (await prisma.payrollRun.create({ data: { month, year, type: "INHOUSE", status, createdById: admin.id } }));

    const hasLines = (await prisma.payrollLine.count({ where: { payrollRunId: run.id } })) > 0;
    if (hasLines) return run;

    for (const e of EMPLOYEES) {
      const employee = await prisma.inHouseEmployee.upsert({
        where: { code: e.code },
        update: {},
        create: {
          code: e.code,
          name: e.name,
          fatherHusbandName: e.fatherHusbandName,
          basicSalary: e.basicSalary,
          department: e.department,
          designation: e.designation,
          joiningDate: new Date(e.joiningDate),
          paymentMode: e.paymentMode,
          bankAccount: e.bankAccount,
          ifsc: e.ifsc,
          pfNo: e.pfNo,
          esicNo: e.esicNo,
          uan: e.uan,
        },
      });

      const result = calculateInHouseWageLine({
        basicSalary: e.basicSalary,
        unpaidLeaveDays: e.unpaidLeaveDays,
        bonus: e.bonus,
        incentive: e.incentive,
      });

      await prisma.payrollLine.create({
        data: {
          payrollRunId: run.id,
          inHouseEmployeeId: employee.id,
          workingDays: 30 - e.unpaidLeaveDays,
          otHours: 0,
          basicEarn: e.basicSalary - result.leaveDeduction,
          otAmount: 0,
          grossEarning: result.grossEarning,
          pf: result.pf,
          esic: result.esic,
          lwf: result.lwf,
          advance: result.advance,
          bonus: result.bonus,
          incentive: result.incentive,
          totalDeduction: result.totalDeduction,
          netPayable: result.netPayable,
        },
      });
    }
    return run;
  }

  await seedInHouseRun(7, 2026, "DRAFT");

  console.log(
    `Seeded company=${company.name} clients=[${client.name}, ${client2.name}] admin=${admin.email} workers=${WORKERS.length + CLIENT2_WORKERS.length} employees=${EMPLOYEES.length}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
