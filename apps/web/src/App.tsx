import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import KanbanPage from './pages/KanbanPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import MyTasksPage from './pages/MyTasksPage';

/**
 * Aguarda a reidratação do Zustand persist antes de renderizar rotas protegidas.
 * Sem isso, o PrivateRoute avalia isAuthenticated=false no primeiro render
 * (antes do localStorage ser lido) e redireciona para /login incorretamente.
 */
function useStoreHydrated() {
    const [hydrated, setHydrated] = useState(
        // Se já estiver hidratado (ex: hot reload), começar como true
        useAuthStore.persist.hasHydrated()
    );

    useEffect(() => {
        if (useAuthStore.persist.hasHydrated()) {
            setHydrated(true);
            return;
        }
        const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
            setHydrated(true);
        });
        return () => unsubscribe();
    }, []);

    return hydrated;
}

/**
 * Roteamento contextual por perfil (PRD §8.3):
 * - Administrador  → Dashboard (visão de configuração)
 * - Gestor         → Dashboard (cards de resumo e gráficos)
 * - Analista       → Projetos (acesso rápido ao backlog e sprints)
 * - Desenvolvedor  → Minhas Tasks (quadro Kanban pessoal filtrado)
 */
function HomeRedirect() {
    const user = useAuthStore((s) => s.user);
    const roleName = user?.role?.name || '';

    if (roleName === 'Desenvolvedor') return <Navigate to="/my-tasks" replace />;
    if (roleName === 'Analista') return <Navigate to="/projects" replace />;
    // Gestor e Administrador → Dashboard
    return <Navigate to="/dashboard" replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const user = useAuthStore((s) => s.user);
    const refreshUserProfile = useAuthStore((s) => s.refreshUserProfile);
    const hydrated = useStoreHydrated();

    useEffect(() => {
        if (isAuthenticated && hydrated) {
            refreshUserProfile();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, hydrated]);

    if (!hydrated) return null;

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.firstLogin) return <Navigate to="/change-password" replace />;

    return <>{children}</>;
}

function AuthorizedRoute({ children, resource, action = 'read' }: { children: React.ReactNode; resource: string; action?: string }) {
    const { hasPermission } = useAuthStore();
    if (!hasPermission(resource, action)) return <Navigate to="/" replace />;
    return <>{children}</>;
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route
                path="/"
                element={
                    <PrivateRoute>
                        <AppLayout />
                    </PrivateRoute>
                }
            >
                <Route index element={<HomeRedirect />} />
                <Route path="dashboard" element={<AuthorizedRoute resource="dashboard"><DashboardPage /></AuthorizedRoute>} />
                <Route path="users" element={<AuthorizedRoute resource="users"><UsersPage /></AuthorizedRoute>} />
                <Route path="roles" element={<AuthorizedRoute resource="roles"><RolesPage /></AuthorizedRoute>} />
                <Route path="projects" element={<AuthorizedRoute resource="projects"><ProjectsPage /></AuthorizedRoute>} />
                <Route path="projects/:projectId" element={<AuthorizedRoute resource="projects"><ProjectDetailPage /></AuthorizedRoute>} />
                <Route path="projects/:projectId/board" element={<AuthorizedRoute resource="tasks"><KanbanPage /></AuthorizedRoute>} />
                <Route path="my-tasks" element={<AuthorizedRoute resource="tasks"><MyTasksPage /></AuthorizedRoute>} />
                <Route path="audit-log" element={<AuthorizedRoute resource="audit_logs"><AuditLogPage /></AuthorizedRoute>} />
                <Route path="settings" element={<AuthorizedRoute resource="settings"><SettingsPage /></AuthorizedRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
