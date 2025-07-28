import { DateTime } from "luxon";
import { PrismaClient } from "../../../prisma/generated";
import { Context } from "../../context";

const prisma = new PrismaClient();

export const SimulationQueryResolvers = {
    // -------- Root Query resolvers --------
    Query: {
        // List all simulations
        simulations: async (_parent: unknown, _args: unknown, ctx: Context) => {
            try {
                const db = ctx?.prisma ?? prisma;
                return await db.simulation.findMany({
                    orderBy: { createdAt: "desc" },
                });
            } catch (err) {
                console.error("Error fetching simulations:", err);
                throw new Error("Failed to fetch simulations");
            }
        },

        // Fetch one simulation by id
        simulation: async (
            _parent: unknown,
            args: { id: string },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                return db.simulation.findUnique({
                    where: { id: args.id },
                    include: {
                        summary: true,
                    },
                });
            } catch (err) {
                console.error("Error fetching simulation:", err);
                throw new Error("Failed to fetch simulation");
            }
        },

        // 12 monthly aggregates for the simulation's span
        simulationMonthlyAggregates: async (
            _parent: unknown,
            args: { simulationId: string },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const rows = await db.simulationResultMonthly.findMany({
                    where: { simulationId: args.simulationId },
                    orderBy: { monthStart: "asc" },
                });

                return rows.map((r) => {
                    const start = DateTime.fromJSDate(r.monthStart).startOf(
                        "month"
                    );
                    const end = start.plus({ months: 1 });
                    return {
                        periodStart: start.toJSDate(),
                        periodEnd: end.toJSDate(),
                        energyKwh: r.energyKwh,
                        eventsCount: r.eventsCount,
                        max15mPowerKw: r.max15mPowerKw,
                    };
                });
            } catch (err) {
                console.error("Error fetching monthly aggregates:", err);
                throw new Error("Failed to fetch monthly aggregates");
            }
        },

        // Daily aggregates
        simulationDailyAggregates: async (
            _parent: unknown,
            args: { simulationId: string },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const rows = await db.simulationResultDaily.findMany({
                    where: { simulationId: args.simulationId },
                    orderBy: { date: "asc" },
                });

                return rows.map((r) => {
                    const start = DateTime.fromJSDate(r.date).startOf("day");
                    const end = start.plus({ days: 1 });
                    return {
                        periodStart: start.toJSDate(),
                        periodEnd: end.toJSDate(),
                        energyKwh: r.energyKwh,
                        eventsCount: r.eventsCount,
                        max15mPowerKw: r.max15mPowerKw,
                    };
                });
            } catch (err) {
                console.error("Error fetching daily aggregates:", err);
                throw new Error("Failed to fetch daily aggregates");
            }
        },

        // 24 hourly rows for a selected date (no chargepoint details)
        simulationHourlyForDate: async (
            _parent: unknown,
            args: { simulationId: string; date: Date },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;

                const parsed = DateTime.fromJSDate(args.date, { zone: "utc" });
                if (!parsed.isValid) {
                    throw new Error(`Invalid date passed: ${args.date}`);
                }

                const dayStart = parsed.startOf("day").toJSDate();
                const dayEnd = parsed
                    .startOf("day")
                    .plus({ days: 1 })
                    .toJSDate();

                const rows = await db.simulationResultHourly.findMany({
                    where: {
                        simulationId: args.simulationId,
                        hourStart: {
                            gte: dayStart,
                            lt: dayEnd,
                        },
                    },
                    orderBy: { hourStart: "asc" },
                    select: {
                        id: true,
                        hourStart: true,
                        energyKwh: true,
                        avgPowerKw: true,
                        max15mPowerKw: true,
                        max15mMinute: true,
                        eventsCount: true,
                    },
                });

                return rows.map((r) => ({
                    id:
                        typeof r.id === "bigint"
                            ? r.id.toString()
                            : (r.id as unknown as string),
                    hourStart: r.hourStart,
                    energyKwh: r.energyKwh,
                    avgPowerKw: r.avgPowerKw,
                    max15mPowerKw: r.max15mPowerKw,
                    max15mMinute: r.max15mMinute,
                    eventsCount: r.eventsCount,
                }));
            } catch (err) {
                console.error("Error fetching hourly data:", err);
                throw new Error("Failed to fetch hourly data");
            }
        },

        // Single hour with per‑chargepoint details (cpState)
        simulationHourlyDetail: async (
            _parent: unknown,
            args: { simulationId: string; hourStart: Date }, // ISO DateTime
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;

                const parsed = DateTime.fromJSDate(args.hourStart, {
                    zone: "utc",
                });
                if (!parsed.isValid)
                    throw new Error(`Invalid hourStart: ${args.hourStart}`);

                const row = await db.simulationResultHourly.findFirst({
                    where: {
                        simulationId: args.simulationId,
                        hourStart: parsed.toJSDate(),
                    },
                });

                if (!row) return null;

                return {
                    id:
                        typeof row.id === "bigint"
                            ? row.id.toString()
                            : (row.id as unknown as string),
                    hourStart: row.hourStart,
                    energyKwh: row.energyKwh,
                    avgPowerKw: row.avgPowerKw,
                    max15mPowerKw: row.max15mPowerKw,
                    max15mMinute: row.max15mMinute,
                    eventsCount: row.eventsCount,
                    busyCpCountAvg: row.busyCpCountAvg ?? null,
                    cpState: row.cpState ?? {},
                };
            } catch (err) {
                console.error("Error fetching hourly detail:", err);
                throw new Error("Failed to fetch hourly detail");
            }
        },

        simulationChargepointDailySeries: async (
            _parent: unknown,
            args: { simulationId: string; cpIndex: number },
            ctx: Context
        ) => {
            const db = ctx?.prisma ?? prisma;

            const hourlyRows = await db.simulationResultHourly.findMany({
                where: { simulationId: args.simulationId },
                orderBy: { hourStart: "asc" },
                select: {
                    hourStart: true,
                    cpState: true,
                },
            });

            const dailyMap = new Map<
                string,
                {
                    energy: number;
                    peakPower: number;
                    occupied: boolean;
                }
            >();

            for (const row of hourlyRows) {
                const day = DateTime.fromJSDate(row.hourStart).toISODate()!;
                const cp = row.cpState as any;
                const energy = cp?.energy_kwh?.[args.cpIndex] ?? 0;
                const power = cp?.power_kw?.[args.cpIndex] ?? 0;
                const occupied = cp?.occupied?.[args.cpIndex] ?? false;

                const prev = dailyMap.get(day) ?? {
                    energy: 0,
                    peakPower: 0,
                    occupied: false,
                };

                dailyMap.set(day, {
                    energy: prev.energy + energy,
                    peakPower: Math.max(prev.peakPower, power),
                    occupied: prev.occupied || occupied,
                });
            }

            return Array.from(dailyMap.entries()).map(([date, val]) => ({
                date,
                energyKwh: val.energy,
                powerKw: val.peakPower,
                occupied: val.occupied,
            }));
        },
    },

    // -------- Field resolvers for Simulation --------
    Simulation: {
        // Yearly summary (one row)
        summary: async (
            parent: { id: string },
            _args: unknown,
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                return db.simulationSummary.findUnique({
                    where: { simulationId: parent.id },
                });
            } catch (err) {
                console.error("Error fetching summary:", err);
                throw new Error("Failed to fetch summary");
            }
        },

        // All hourly rows for plotting graphs/heatmaps (without cp details)
        hourlyResults: async (
            parent: { id: string },
            _args: unknown,
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const rows = await db.simulationResultHourly.findMany({
                    where: { simulationId: parent.id },
                    orderBy: { hourStart: "asc" },
                    select: {
                        id: true,
                        hourStart: true,
                        energyKwh: true,
                        avgPowerKw: true,
                        max15mPowerKw: true,
                        max15mMinute: true,
                        eventsCount: true,
                    },
                });

                return rows.map((r) => ({
                    id:
                        typeof r.id === "bigint"
                            ? r.id.toString()
                            : (r.id as unknown as string),
                    hourStart: r.hourStart,
                    energyKwh: r.energyKwh,
                    avgPowerKw: r.avgPowerKw,
                    max15mPowerKw: r.max15mPowerKw,
                    max15mMinute: r.max15mMinute,
                    eventsCount: r.eventsCount,
                }));
            } catch (err) {
                console.error("Error fetching hourly results:", err);
                throw new Error("Failed to fetch hourly results");
            }
        },

        // Convenience: 12 monthly aggregates directly under Simulation
        monthlyResults: async (
            parent: { id: string },
            _args: unknown,
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const rows = await db.simulationResultMonthly.findMany({
                    where: { simulationId: parent.id },
                    orderBy: { monthStart: "asc" },
                });

                return rows.map((r) => {
                    const start = DateTime.fromJSDate(r.monthStart).startOf(
                        "month"
                    );
                    const end = start.plus({ months: 1 });
                    return {
                        periodStart: start.toJSDate(),
                        periodEnd: end.toJSDate(),
                        energyKwh: r.energyKwh,
                        eventsCount: r.eventsCount,
                        max15mPowerKw: r.max15mPowerKw,
                    };
                });
            } catch (err) {
                console.error("Error fetching monthly results:", err);
                throw new Error("Failed to fetch monthly results");
            }
        },

        // Convenience: daily aggregates directly under Simulation
        dailyResults: async (
            parent: { id: string },
            _args: unknown,
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const rows = await db.simulationResultDaily.findMany({
                    where: { simulationId: parent.id },
                    orderBy: { date: "asc" },
                });

                return rows.map((r) => {
                    const start = DateTime.fromJSDate(r.date).startOf("day");
                    const end = start.plus({ days: 1 });
                    return {
                        periodStart: start.toJSDate(),
                        periodEnd: end.toJSDate(),
                        energyKwh: r.energyKwh,
                        eventsCount: r.eventsCount,
                        max15mPowerKw: r.max15mPowerKw,
                    };
                });
            } catch (err) {
                console.error("Error fetching daily results:", err);
                throw new Error("Failed to fetch daily results");
            }
        },
    },
};

export default SimulationQueryResolvers;
