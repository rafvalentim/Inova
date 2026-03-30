import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile, Permissions } from '@inova/shared';

interface AuthState {
    user: UserProfile | null;
    isAuthenticated: boolean;
    setUser: (user: UserProfile) => void;
    login: (user: UserProfile) => void;
    logout: () => void;
    hasPermission: (resource: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,

            setUser: (user) => set({ user }),

            login: (user) =>
                set({
                    user,
                    isAuthenticated: true,
                }),

            logout: () =>
                set({
                    user: null,
                    isAuthenticated: false,
                }),

            hasPermission: (resource: string, action: string): boolean => {
                const { user } = get();
                if (!user) return false;

                // Admin has all permissions
                if (user.role.name === 'Administrador') return true;

                const permissions = user.role.permissions as Permissions;
                const resourcePerms = permissions[resource as keyof Permissions];
                return !!resourcePerms && resourcePerms.includes(action as any);
            },
        }),
        {
            name: 'inova-auth',
            storage: createJSONStorage(() => localStorage),
            // Versão 2: removidos accessToken e refreshToken (agora em httpOnly cookies, RNF-008)
            version: 2,
            migrate: (persistedState: any, fromVersion: number) => {
                // Qualquer versão anterior ao schema atual: limpar tokens e garantir shape correto
                if (fromVersion < 2) {
                    return {
                        user: persistedState?.user ?? null,
                        isAuthenticated: persistedState?.user != null && persistedState?.isAuthenticated === true,
                    };
                }
                return persistedState as AuthState;
            },
            // Persistir apenas user e isAuthenticated — tokens ficam em httpOnly cookies (RNF-008)
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);
