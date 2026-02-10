import axios from "axios";
import { clearAuth, getToken } from "../config/auth";

export const auth_server = axios.create({
    baseURL: import.meta.env.VITE_AUTH_SERVER_BASE_URL || "http://localhost:8000",
    headers: { "Content-Type": "application/json" }
});

export const rule_server = axios.create({
    baseURL: import.meta.env.VITE_RULE_ENGINE_BASE_URL || "http://localhost:8080",
    headers: { "Content-Type": "application/json" }
});

auth_server.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

rule_server.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

auth_server.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) clearAuth();
        return Promise.reject(err);
    }
);

rule_server.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err?.response?.status === 401) clearAuth();
        return Promise.reject(err);
    }
);