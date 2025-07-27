import seedrandom from "seedrandom";
import { PrismaClient } from "../generated/prisma";
import { chargingDemands, hourlyArrivalProbs } from "./data";
import { DateTime, Interval } from "luxon";

type RNG = () => number;

// For Simplicity! Canonical non‑leap year in UTC
const CANONICAL_START_UTC = DateTime.utc(2001, 1, 1, 0, 0, 0, 0);
const CANONICAL_END_UTC = CANONICAL_START_UTC.plus({ days: 365 });

function sampleChargingDemand(rng: RNG): number {
    const r = rng();
    let cumulative = 0;
    for (const d of chargingDemands) {
        cumulative += d.prob;
        if (r < cumulative) return d.km;
    }
    return 0;
}

function buildCpStatePayload(opts: {
    perCpPowerKwAtPeak: number[];
    perCpOccupiedAtPeak: boolean[];
    perCpEnergyKwhInHour: number[];
}) {
    const { perCpPowerKwAtPeak, perCpOccupiedAtPeak, perCpEnergyKwhInHour } =
        opts;
    return {
        power_kw: perCpPowerKwAtPeak,
        occupied: perCpOccupiedAtPeak,
        energy_kwh: perCpEnergyKwhInHour,
    };
}

export default async function runEngineAndPersist(
    db: PrismaClient,
    simulationId: string
) {
    const sim = await db.simulation.findUnique({ where: { id: simulationId } });
    if (!sim) throw new Error("Simulation not found.");

    // Clean re-run
    await db.$transaction([
        db.simulationResultHourly.deleteMany({ where: { simulationId } }),
        db.simulationResultDaily.deleteMany({ where: { simulationId } }),
        db.simulationResultMonthly.deleteMany({ where: { simulationId } }),
        db.simulationSummary.deleteMany({ where: { simulationId } }),
    ]);

    const cpCount = sim.chargepointCount;
    const chargerPowerKw = sim.chargerPowerKw;
    const energyPerTickKwh = chargerPowerKw * 0.25; // 15-min
    const kwhPerKm = (sim.consumptionKwhPer100km ?? 18) / 100;
    const arrivalMult = sim.arrivalMultiplier ?? 1.0;
    const theoreticalMaxKw = cpCount * chargerPowerKw;

    const seed = (sim.seed ?? 0).toString();
    const rng: RNG =
        sim.seed === null || sim.seed === undefined
            ? Math.random
            : seedrandom(seed);

    // Use canonical UTC window
    const startUtc = CANONICAL_START_UTC.startOf("minute");
    const endUtc = CANONICAL_END_UTC.startOf("minute");

    const remainingEnergies = new Array<number>(cpCount).fill(0);

    type HourAgg = {
        hourStartUtc: Date;
        energyKwh: number;
        eventsCount: number;
        max15mPowerKw: number;
        max15mMinute: number;
        occupancyTicks: number;
        perCpEnergyKwh: number[];
        perCpPowerKwAtPeak: number[];
        perCpOccupiedAtPeak: boolean[];
    };
    const byHour = new Map<string, HourAgg>();

    let totalEnergy = 0;
    let actualPeakKw = 0;
    let actualPeakAt: Date | null = null;

    for (let t = startUtc; t < endUtc; t = t.plus({ minutes: 15 })) {
        const utcHour = t.hour; // 0..23 (UTC)
        const minute = t.minute;
        const minuteIndex = minute % 60;
        const hourStartUtc = t.startOf("hour").toJSDate();
        const hourKey = hourStartUtc.toISOString();

        let agg = byHour.get(hourKey);
        if (!agg) {
            agg = {
                hourStartUtc,
                energyKwh: 0,
                eventsCount: 0,
                max15mPowerKw: 0,
                max15mMinute: 0,
                occupancyTicks: 0,
                perCpEnergyKwh: new Array<number>(cpCount).fill(0),
                perCpPowerKwAtPeak: new Array<number>(cpCount).fill(0),
                perCpOccupiedAtPeak: new Array<boolean>(cpCount).fill(false),
            };
            byHour.set(hourKey, agg);
        }

        const arrivalProbPerCp = Math.min(
            1,
            Math.max(
                0,
                ((hourlyArrivalProbs[utcHour] ?? 0) * (arrivalMult ?? 1)) / 4
            )
        );

        let intervalEnergy = 0;
        const perCpDeliveredKwh = new Array<number>(cpCount).fill(0);
        let occupiedNow = 0;

        for (let i = 0; i < cpCount; i++) {
            if (remainingEnergies[i] <= 0) {
                if (rng() < arrivalProbPerCp) {
                    const km = sampleChargingDemand(rng);
                    if (km > 0) {
                        remainingEnergies[i] = km * kwhPerKm;
                        agg.eventsCount += 1;
                    }
                }
            }

            if (remainingEnergies[i] > 0) {
                const delivered = Math.min(
                    remainingEnergies[i],
                    energyPerTickKwh
                );
                remainingEnergies[i] -= delivered;
                intervalEnergy += delivered;
                perCpDeliveredKwh[i] = delivered;
                occupiedNow += 1;
            }
        }

        totalEnergy += intervalEnergy;

        const powerThisIntervalKw = intervalEnergy * 4;
        if (powerThisIntervalKw > actualPeakKw) {
            actualPeakKw = powerThisIntervalKw;
            actualPeakAt = t.toJSDate();
        }

        agg.energyKwh += intervalEnergy;
        agg.occupancyTicks += occupiedNow;
        for (let i = 0; i < cpCount; i++) {
            agg.perCpEnergyKwh[i] += perCpDeliveredKwh[i];
        }

        if (powerThisIntervalKw > agg.max15mPowerKw) {
            agg.max15mPowerKw = powerThisIntervalKw;
            agg.max15mMinute = minuteIndex;
            for (let i = 0; i < cpCount; i++) {
                agg.perCpPowerKwAtPeak[i] = perCpDeliveredKwh[i] * 4;
                agg.perCpOccupiedAtPeak[i] = perCpDeliveredKwh[i] > 0;
            }
        }
    }

    const hourlyRows = [...byHour.values()].sort(
        (a, b) => a.hourStartUtc.getTime() - b.hourStartUtc.getTime()
    );

    // Persist hourly
    const chunkSize = 2000;
    for (let i = 0; i < hourlyRows.length; i += chunkSize) {
        const chunk = hourlyRows.slice(i, i + chunkSize);
        await db.simulationResultHourly.createMany({
            data: chunk.map((h) => ({
                simulationId,
                hourStart: h.hourStartUtc, // UTC
                energyKwh: h.energyKwh,
                avgPowerKw: h.energyKwh, // 1-hour bucket
                max15mPowerKw: h.max15mPowerKw,
                max15mMinute: h.max15mMinute,
                eventsCount: h.eventsCount,
                busyCpCountAvg: h.occupancyTicks / 4,
                cpState: buildCpStatePayload({
                    perCpPowerKwAtPeak: h.perCpPowerKwAtPeak,
                    perCpOccupiedAtPeak: h.perCpOccupiedAtPeak,
                    perCpEnergyKwhInHour: h.perCpEnergyKwh,
                }),
            })),
        });
    }

    // Daily aggregates (UTC)
    const byDay = new Map<
        string,
        { energy: number; events: number; max15: number }
    >();
    for (const h of hourlyRows) {
        const key = DateTime.fromJSDate(h.hourStartUtc, {
            zone: "utc",
        }).toISODate()!;
        const curr = byDay.get(key) ?? { energy: 0, events: 0, max15: 0 };
        curr.energy += h.energyKwh;
        curr.events += h.eventsCount;
        curr.max15 = Math.max(curr.max15, h.max15mPowerKw);
        byDay.set(key, curr);
    }

    const dailyRows = [...byDay.entries()]
        .map(([isoDate, v]) => ({
            simulationId,
            date: DateTime.fromISO(isoDate, { zone: "utc" }).toJSDate(), // DATE (UTC)
            energyKwh: v.energy,
            eventsCount: v.events,
            max15mPowerKw: v.max15,
        }))
        .sort((a, b) => (a.date as any) - (b.date as any));

    for (let i = 0; i < dailyRows.length; i += chunkSize) {
        await db.simulationResultDaily.createMany({
            data: dailyRows.slice(i, i + chunkSize),
        });
    }

    // Monthly aggregates (UTC, first day of month)
    const byMonth = new Map<
        string,
        { energy: number; events: number; max15: number }
    >();
    for (const h of hourlyRows) {
        const key = DateTime.fromJSDate(h.hourStartUtc, { zone: "utc" })
            .startOf("month")
            .toISODate()!;
        const curr = byMonth.get(key) ?? { energy: 0, events: 0, max15: 0 };
        curr.energy += h.energyKwh;
        curr.events += h.eventsCount;
        curr.max15 = Math.max(curr.max15, h.max15mPowerKw);
        byMonth.set(key, curr);
    }

    const monthlyRows = [...byMonth.entries()]
        .map(([isoMonthStart, v]) => ({
            simulationId,
            monthStart: DateTime.fromISO(isoMonthStart, {
                zone: "utc",
            }).toJSDate(), // DATE (UTC)
            energyKwh: v.energy,
            eventsCount: v.events,
            max15mPowerKw: v.max15,
        }))
        .sort((a, b) => (a.monthStart as any) - (b.monthStart as any));

    if (monthlyRows.length > 0) {
        await db.simulationResultMonthly.createMany({ data: monthlyRows });
    }

    const durationHours = Math.round(
        Interval.fromDateTimes(startUtc, endUtc).length("hours") ?? 0
    );
    const concurrencyFactor =
        theoreticalMaxKw > 0 ? actualPeakKw / theoreticalMaxKw : 0;

    await db.simulationSummary.create({
        data: {
            simulationId,
            totalEnergyKwh: totalEnergy,
            theoreticalMaxKw,
            actualPeakKw: isFinite(actualPeakKw) ? actualPeakKw : 0,
            actualPeakAt: actualPeakAt ?? startUtc.toJSDate(),
            concurrencyFactor,
            eventsTotal: hourlyRows.reduce((s, r) => s + r.eventsCount, 0),
            durationHours,
        },
    });
}
