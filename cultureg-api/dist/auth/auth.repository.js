"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findByEmail = findByEmail;
exports.findById = findById;
const prisma_1 = require("../shared/prisma");
const userSelect = {
    id: true,
    email: true,
    username: true,
    elo: true,
    createdAt: true,
};
async function createUser(data) {
    return prisma_1.prisma.user.create({
        data,
        select: userSelect,
    });
}
async function findByEmail(email) {
    return prisma_1.prisma.user.findUnique({ where: { email } });
}
async function findById(userId) {
    return prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: userSelect,
    });
}
