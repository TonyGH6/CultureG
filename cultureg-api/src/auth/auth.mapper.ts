export type UserDto = {
    id: string;
    email: string;
    username: string;
    elo: number;
    createdAt: Date;
};

export type AuthResponseDto = {
    token: string;
    user: UserDto;
};

export function toUserDto(user: {
    id: string;
    email: string;
    username: string;
    elo: number;
    createdAt: Date;
}): UserDto {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        elo: user.elo,
        createdAt: user.createdAt,
    };
}

export function toAuthResponseDto(token: string, user: UserDto): AuthResponseDto {
    return { token, user };
}
