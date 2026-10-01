-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalCustomerId" TEXT,
    "userId" TEXT,
    "gender" TEXT NOT NULL,
    "seniorCitizen" INTEGER NOT NULL,
    "partner" TEXT NOT NULL,
    "dependents" TEXT NOT NULL,
    "tenure" INTEGER NOT NULL,
    "phoneService" TEXT NOT NULL,
    "multipleLines" TEXT NOT NULL,
    "internetService" TEXT NOT NULL,
    "onlineSecurity" TEXT NOT NULL,
    "onlineBackup" TEXT NOT NULL,
    "deviceProtection" TEXT NOT NULL,
    "techSupport" TEXT NOT NULL,
    "streamingTV" TEXT NOT NULL,
    "streamingMovies" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "paperlessBilling" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "monthlyCharges" REAL NOT NULL,
    "totalCharges" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "prediction" TEXT NOT NULL,
    "churnProbability" REAL NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "modelUsed" TEXT NOT NULL,
    "predictedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prediction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalCustomerId_key" ON "Customer"("externalCustomerId");

-- CreateIndex
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Prediction_customerId_predictedAt_idx" ON "Prediction"("customerId", "predictedAt");

-- CreateIndex
CREATE INDEX "Prediction_prediction_idx" ON "Prediction"("prediction");

-- CreateIndex
CREATE INDEX "Prediction_riskLevel_idx" ON "Prediction"("riskLevel");
