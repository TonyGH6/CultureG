import { prisma } from "../shared/prisma";

const userSelect = {
    id: true,
    email: true,
    username: true,
    elo: true,
    createdAt: true,
} as const;

export async function createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
}) {
    return prisma.user.create({
        data,
        select: userSelect,
    });
}

export async function findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
}

export async function findById(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
    });
}
