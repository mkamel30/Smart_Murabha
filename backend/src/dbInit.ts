import { PrismaClient } from '@prisma/client';

const INIT_SQL = `
-- CreateTable
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bkCode" TEXT NOT NULL,
    "customerType" TEXT NOT NULL DEFAULT 'عام',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MachineSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "machineSerial" TEXT NOT NULL,
    "saleType" TEXT NOT NULL,
    "totalPrice" DECIMAL NOT NULL,
    "downPayment" DECIMAL NOT NULL DEFAULT 0,
    "downPaymentReceipt" TEXT,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL NOT NULL,
    "paymentPlace" TEXT,
    "notes" TEXT,
    "saleDate" DATETIME NOT NULL,
    "firstDueDate" DATETIME,
    "months" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MachineSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "paymentId" TEXT,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "isWaived" BOOLEAN NOT NULL DEFAULT false,
    "waiveReason" TEXT,
    "paidDate" DATETIME,
    "receiptNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Installment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paymentPlace" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "nextFollowUp" DATETIME,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_bkCode_idx" ON "Customer"("bkCode");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_bkCode_customerType_key" ON "Customer"("bkCode", "customerType");
CREATE UNIQUE INDEX IF NOT EXISTS "MachineSale_receiptNumber_key" ON "MachineSale"("receiptNumber");
CREATE INDEX IF NOT EXISTS "MachineSale_customerId_idx" ON "MachineSale"("customerId");
CREATE INDEX IF NOT EXISTS "MachineSale_saleDate_idx" ON "MachineSale"("saleDate");
CREATE INDEX IF NOT EXISTS "MachineSale_status_idx" ON "MachineSale"("status");
CREATE INDEX IF NOT EXISTS "MachineSale_receiptNumber_idx" ON "MachineSale"("receiptNumber");
CREATE INDEX IF NOT EXISTS "MachineSale_machineSerial_idx" ON "MachineSale"("machineSerial");
CREATE INDEX IF NOT EXISTS "Installment_saleId_idx" ON "Installment"("saleId");
CREATE INDEX IF NOT EXISTS "Installment_dueDate_idx" ON "Installment"("dueDate");
CREATE INDEX IF NOT EXISTS "Installment_isPaid_idx" ON "Installment"("isPaid");
CREATE INDEX IF NOT EXISTS "Installment_paymentId_idx" ON "Installment"("paymentId");
CREATE INDEX IF NOT EXISTS "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt");
CREATE INDEX IF NOT EXISTS "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");
CREATE INDEX IF NOT EXISTS "FollowUp_customerId_idx" ON "FollowUp"("customerId");
CREATE INDEX IF NOT EXISTS "FollowUp_nextFollowUp_idx" ON "FollowUp"("nextFollowUp");
CREATE INDEX IF NOT EXISTS "FollowUp_isCompleted_idx" ON "FollowUp"("isCompleted");
`;

export async function ensureTablesExist(prisma: PrismaClient) {
  console.log('🔄 Verifying database tables...');
  try {
    // Check if Customer table exists
    await prisma.$queryRawUnsafe('SELECT 1 FROM Customer LIMIT 1');
    console.log('✅ Database tables already exist.');
  } catch (err) {
    console.log('⚠️ Database tables missing. Initializing schema...');
    const statements = INIT_SQL.split(';').filter(s => s.trim().length > 0);
    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
      } catch (sqlErr: any) {
        console.error('❌ Failed to execute SQL statement:', sql);
        console.error('Error:', sqlErr.message);
      }
    }
    console.log('✅ Database schema initialized successfully.');
  }
}
