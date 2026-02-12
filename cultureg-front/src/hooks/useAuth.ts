import { useState, useCallback } from "react";
import { api, type LoginResp } from "../api";

export function useAuth() {
    const [token, setToken] = useState("");
    const [userId, setUserId] = useState("");
    const [elo, setElo] = useState(0);
    const [username, setUsername] = useState("");

    const isAuthed = Boolean(token);

    const login = useCallback(
        async (email: string, password: string) => {
            const data = await api<LoginResp>("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
            });

            setToken(data.token);
            setUserId(data.user.id);
            setElo(data.user.elo);
            setUsername(data.user.username);

            return data;
        },
        []
    );

    const logout = useCallback(() => {
        setToken("");
        setUserId("");
        setElo(0);
        setUsername("");
    }, []);

    return { token, userId, elo, username, isAuthed, login, logout };
}
