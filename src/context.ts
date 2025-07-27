import { PrismaClient } from "../prisma/generated";

export interface Context {
    prisma: PrismaClient;
}
