import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { calculateInHouseWageLine } from "../src/engine/inhousePayroll";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
const prisma = new PrismaClient({ adapter });

// Fixture values taken verbatim from PROJECT_SPEC.md section 7 (the real
// source workbook) — used as regression baseline once the calc engine lands.
const WORKERS = [
  { code: "CW-001", name: "Arun", basicSalary: 17000, workingDays: 23, otHours: 58, grossEarning: 17141.67, totalDeduction: 162.85, advance: 1000, netPayable: 15978.82 },
  { code: "CW-002", name: "Biru Kumar", basicSalary: 17000, workingDays: 18, otHours: 51, grossEarning: 13812.50, totalDeduction: 131.22, advance: 5000, netPayable: 8681.28 },
  { code: "CW-003", name: "Suraj", basicSalary: 17000, workingDays: 3, otHours: 1, grossEarning: 1770.83, totalDeduction: 16.82, advance: 0, netPayable: 1754.01 },
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

  async function seedContractRun(month: number, year: number, status: "DRAFT" | "FINALIZED") {
    const run = await prisma.payrollRun.upsert({
      where: { month_year_type: { month, year, type: "CONTRACT" } },
      update: {},
      create: { month, year, type: "CONTRACT", status, createdById: admin.id },
    });

    const hasLines = (await prisma.payrollLine.count({ where: { payrollRunId: run.id } })) > 0;
    if (hasLines) return run;

    for (const w of WORKERS) {
      const worker = await prisma.contractWorker.upsert({
        where: { code: w.code },
        update: {},
        create: { code: w.code, name: w.name, basicSalary: w.basicSalary },
      });

      const basicEarn = Math.round(((w.basicSalary / 30) * w.workingDays) * 100) / 100;
      const otAmount = Math.round(((w.basicSalary / 30 / 8) * w.otHours) * 100) / 100;

      await prisma.payrollLine.create({
        data: {
          payrollRunId: run.id,
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
    return run;
  }

  // June: finalized, already billable. July: this month's open run, no bill yet.
  await seedContractRun(6, 2026, "FINALIZED");
  await seedContractRun(7, 2026, "DRAFT");

  async function seedInHouseRun(month: number, year: number, status: "DRAFT" | "FINALIZED") {
    const run = await prisma.payrollRun.upsert({
      where: { month_year_type: { month, year, type: "INHOUSE" } },
      update: {},
      create: { month, year, type: "INHOUSE", status, createdById: admin.id },
    });

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

  console.log(`Seeded company=${company.name} client=${client.name} admin=${admin.email} workers=${WORKERS.length} employees=${EMPLOYEES.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
