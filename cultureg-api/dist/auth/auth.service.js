"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getMe = getMe;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
const result_1 = require("../shared/result");
const authRepo = __importStar(require("./auth.repository"));
const auth_mapper_1 = require("./auth.mapper");
async function register(input) {
    const passwordHash = await bcrypt_1.default.hash(input.password, 10);
    try {
        const user = await authRepo.createUser({
            email: input.email,
            username: input.username,
            passwordHash,
        });
        const userDto = (0, auth_mapper_1.toUserDto)(user);
        const token = jsonwebtoken_1.default.sign({ sub: userDto.id }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
        return (0, result_1.ok)((0, auth_mapper_1.toAuthResponseDto)(token, userDto));
    }
    catch {
        return (0, result_1.err)(409, "Email or username already used");
    }
}
async function login(input) {
    const user = await authRepo.findByEmail(input.email);
    if (!user)
        return (0, result_1.err)(401, "Invalid credentials");
    const valid = await bcrypt_1.default.compare(input.password, user.passwordHash);
    if (!valid)
        return (0, result_1.err)(401, "Invalid credentials");
    const userDto = (0, auth_mapper_1.toUserDto)(user);
    const token = jsonwebtoken_1.default.sign({ sub: userDto.id }, env_1.env.JWT_SECRET, { expiresIn: "7d" });
    return (0, result_1.ok)((0, auth_mapper_1.toAuthResponseDto)(token, userDto));
}
async function getMe(userId) {
    const user = await authRepo.findById(userId);
    if (!user)
        return (0, result_1.err)(404, "User not found");
    return (0, result_1.ok)({ user: (0, auth_mapper_1.toUserDto)(user) });
}
