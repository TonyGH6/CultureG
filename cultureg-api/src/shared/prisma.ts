import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    accelerateUrl: process.env.PRISMA_URL,
});
