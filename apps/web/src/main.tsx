import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './providers/ThemeProvider';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Tenta até 2 vezes em caso de falha de rede ou token sendo renovado
            retry: (failureCount, error: any) => {
                // Não tentar novamente em erros 403 (sem permissão) ou 404
                if (error?.response?.status === 403 || error?.response?.status === 404) return false;
                return failureCount < 2;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
            refetchOnWindowFocus: false,
            staleTime: 60000, // 1 minuto — reduz recarregamentos desnecessários
        },
    },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ThemeProvider>
        </QueryClientProvider>
    </React.StrictMode>
);
