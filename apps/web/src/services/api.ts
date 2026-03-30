import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * Access token armazenado em memória (variável de módulo).
 * - Nunca toca localStorage nem cookies acessíveis ao JS (RNF-008)
 * - Sobrevive a navegação de rota mas é limpo ao fechar a aba/recarregar
 * - Ao recarregar, o interceptor de 401 usa o refreshToken cookie (httpOnly)
 *   para renovar silenciosamente o access token
 */
let _accessToken: string | null = null;

export const tokenManager = {
    get: () => _accessToken,
    set: (token: string | null) => { _accessToken = token; },
    clear: () => { _accessToken = null; },
};

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
    // Necessário para enviar o cookie httpOnly do refreshToken
    withCredentials: true,
});

// Request interceptor — injeta access token em memória no header
api.interceptors.request.use((config) => {
    const token = tokenManager.get();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (err: any) => void }> = [];

const processQueue = (error: any) => {
    failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve();
    });
    failedQueue = [];
};

// Response interceptor — renova access token via refreshToken cookie (httpOnly)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Não interceptar erros de login/refresh — deixar o handler da página tratar
            if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
                tokenManager.clear();
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => api(originalRequest))
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // O cookie refreshToken (httpOnly) é enviado automaticamente pelo browser
                // O backend valida, rotaciona o refreshToken cookie e retorna novo accessToken no body
                const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
                const { accessToken } = res.data.data;

                tokenManager.set(accessToken);
                processQueue(null);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return api(originalRequest);
            } catch (err) {
                processQueue(err);
                tokenManager.clear();
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(err);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
