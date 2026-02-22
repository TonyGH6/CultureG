"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toUserDto = toUserDto;
exports.toAuthResponseDto = toAuthResponseDto;
function toUserDto(user) {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        elo: user.elo,
        createdAt: user.createdAt,
    };
}
function toAuthResponseDto(token, user) {
    return { token, user };
}
