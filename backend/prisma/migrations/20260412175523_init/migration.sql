-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bkCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MachineSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "machineSerial" TEXT NOT NULL,
    "saleType" TEXT NOT NULL,
    "totalPrice" REAL NOT NULL,
    "downPayment" REAL NOT NULL DEFAULT 0,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "remainingAmount" REAL NOT NULL,
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
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" DATETIME,
    "receiptNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Installment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "paymentPlace" TEXT,
    "notes" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "MachineSale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
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
CREATE UNIQUE INDEX "Customer_bkCode_key" ON "Customer"("bkCode");

-- CreateIndex
CREATE INDEX "Customer_bkCode_idx" ON "Customer"("bkCode");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "MachineSale_receiptNumber_key" ON "MachineSale"("receiptNumber");

-- CreateIndex
CREATE INDEX "MachineSale_customerId_idx" ON "MachineSale"("customerId");

-- CreateIndex
CREATE INDEX "MachineSale_saleDate_idx" ON "MachineSale"("saleDate");

-- CreateIndex
CREATE INDEX "MachineSale_status_idx" ON "MachineSale"("status");

-- CreateIndex
CREATE INDEX "MachineSale_receiptNumber_idx" ON "MachineSale"("receiptNumber");

-- CreateIndex
CREATE INDEX "Installment_saleId_idx" ON "Installment"("saleId");

-- CreateIndex
CREATE INDEX "Installment_dueDate_idx" ON "Installment"("dueDate");

-- CreateIndex
CREATE INDEX "Installment_isPaid_idx" ON "Installment"("isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_receiptNumber_idx" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "FollowUp_customerId_idx" ON "FollowUp"("customerId");

-- CreateIndex
CREATE INDEX "FollowUp_nextFollowUp_idx" ON "FollowUp"("nextFollowUp");

-- CreateIndex
CREATE INDEX "FollowUp_isCompleted_idx" ON "FollowUp"("isCompleted");
