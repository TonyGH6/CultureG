import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { ok, err, type ServiceResult } from "../shared/result";
import * as authRepo from "./auth.repository";
import { toUserDto, toAuthResponseDto, type AuthResponseDto, type UserDto } from "./auth.mapper";
import type { RegisterInput, LoginInput } from "./auth.validator";

export async function register(
    input: RegisterInput
): Promise<ServiceResult<AuthResponseDto>> {
    const passwordHash = await bcrypt.hash(input.password, 10);

    try {
        const user = await authRepo.createUser({
            email: input.email,
            username: input.username,
            passwordHash,
        });

        const userDto = toUserDto(user);
        const token = jwt.sign({ sub: userDto.id }, env.JWT_SECRET, { expiresIn: "7d" });

        return ok(toAuthResponseDto(token, userDto));
    } catch {
        return err(409, "Email or username already used");
    }
}

export async function login(
    input: LoginInput
): Promise<ServiceResult<AuthResponseDto>> {
    const user = await authRepo.findByEmail(input.email);
    if (!user) return err(401, "Invalid credentials");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) return err(401, "Invalid credentials");

    const userDto = toUserDto(user);
    const token = jwt.sign({ sub: userDto.id }, env.JWT_SECRET, { expiresIn: "7d" });

    return ok(toAuthResponseDto(token, userDto));
}

export async function getMe(
    userId: string
): Promise<ServiceResult<{ user: UserDto }>> {
    const user = await authRepo.findById(userId);
    if (!user) return err(404, "User not found");

    return ok({ user: toUserDto(user) });
}
