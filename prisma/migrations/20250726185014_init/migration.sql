-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "Simulation" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" "SimulationStatus" NOT NULL DEFAULT 'queued',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "seed" INTEGER,
    "arrivalMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "chargepointCount" INTEGER NOT NULL,
    "consumptionKwhPer100km" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "chargerPowerKw" DOUBLE PRECISION NOT NULL DEFAULT 11,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationSummary" (
    "simulationId" TEXT NOT NULL,
    "totalEnergyKwh" DOUBLE PRECISION NOT NULL,
    "theoreticalMaxKw" DOUBLE PRECISION NOT NULL,
    "actualPeakKw" DOUBLE PRECISION NOT NULL,
    "actualPeakAt" TIMESTAMP(3) NOT NULL,
    "concurrencyFactor" DOUBLE PRECISION NOT NULL,
    "eventsTotal" INTEGER NOT NULL,
    "durationHours" INTEGER NOT NULL,

    CONSTRAINT "SimulationSummary_pkey" PRIMARY KEY ("simulationId")
);

-- CreateTable
CREATE TABLE "SimulationResultHourly" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "hourStart" TIMESTAMP(3) NOT NULL,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "avgPowerKw" DOUBLE PRECISION NOT NULL,
    "max15mPowerKw" DOUBLE PRECISION NOT NULL,
    "max15mMinute" INTEGER NOT NULL,
    "eventsCount" INTEGER NOT NULL,
    "cpState" JSONB NOT NULL,

    CONSTRAINT "SimulationResultHourly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResultDaily" (
    "id" TEXT NOT NULL,
    "simulationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "max15mPowerKw" DOUBLE PRECISION NOT NULL,
    "eventsCount" INTEGER NOT NULL,

    CONSTRAINT "SimulationResultDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationResultHourly_simulationId_hourStart_idx" ON "SimulationResultHourly"("simulationId", "hourStart");

-- CreateIndex
CREATE INDEX "SimulationResultDaily_date_idx" ON "SimulationResultDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationResultDaily_simulationId_date_key" ON "SimulationResultDaily"("simulationId", "date");

-- AddForeignKey
ALTER TABLE "SimulationSummary" ADD CONSTRAINT "SimulationSummary_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResultHourly" ADD CONSTRAINT "SimulationResultHourly_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResultDaily" ADD CONSTRAINT "SimulationResultDaily_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
