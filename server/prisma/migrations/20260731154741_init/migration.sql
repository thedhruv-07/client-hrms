-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'HR', 'ACCOUNTANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "PayrollType" AS ENUM ('CONTRACT', 'INHOUSE');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "mobile" TEXT,
    "gstNo" TEXT,
    "panNo" TEXT,
    "pfCode" TEXT,
    "esiCode" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gstNo" TEXT,
    "panNo" TEXT,
    "hsnSac" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractWorker" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "pfNo" TEXT,
    "esicNo" TEXT,
    "uan" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InHouseEmployee" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "leaveBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "pfNo" TEXT,
    "esicNo" TEXT,
    "uan" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InHouseEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "PayrollType" NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLine" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "contractWorkerId" TEXT,
    "inHouseEmployeeId" TEXT,
    "workingDays" DECIMAL(5,2) NOT NULL,
    "otHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "basicEarn" DECIMAL(12,2) NOT NULL,
    "otAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grossEarning" DECIMAL(12,2) NOT NULL,
    "pf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "esic" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lwf" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "incentive" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeduction" DECIMAL(12,2) NOT NULL,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "basicWages" DECIMAL(12,2) NOT NULL,
    "hra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "con" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "incentiveAmt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total1" DECIMAL(12,2) NOT NULL,
    "esiEmployer" DECIMAL(12,2) NOT NULL,
    "esiEmployee" DECIMAL(12,2) NOT NULL,
    "lwf1" DECIMAL(12,2) NOT NULL,
    "serviceCharge" DECIMAL(12,2) NOT NULL,
    "lwf2" DECIMAL(12,2) NOT NULL,
    "total2" DECIMAL(12,2) NOT NULL,
    "cgst" DECIMAL(12,2) NOT NULL,
    "sgst" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ContractWorker_code_key" ON "ContractWorker"("code");

-- CreateIndex
CREATE UNIQUE INDEX "InHouseEmployee_code_key" ON "InHouseEmployee"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_month_year_type_key" ON "PayrollRun"("month", "year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billNo_key" ON "Bill"("billNo");

-- CreateIndex
CREATE UNIQUE INDEX "BillLine_billId_key" ON "BillLine"("billId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_contractWorkerId_fkey" FOREIGN KEY ("contractWorkerId") REFERENCES "ContractWorker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_inHouseEmployeeId_fkey" FOREIGN KEY ("inHouseEmployeeId") REFERENCES "InHouseEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
