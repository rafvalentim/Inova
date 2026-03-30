import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, useMatch } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Switch, Breadcrumb } from 'antd';
import {
    DashboardOutlined,
    ProjectOutlined,
    TeamOutlined,
    CheckSquareOutlined,
    SafetyCertificateOutlined,
    AuditOutlined,
    SettingOutlined,
    LogoutOutlined,
    UserOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    BulbOutlined,
    MoonOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import api, { tokenManager } from '../services/api';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export default function AppLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout, hasPermission } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // ignore
        }
        tokenManager.clear();
        logout();
        navigate('/login');
    };

    const menuItems = [
        {
            key: '/dashboard',
            icon: <DashboardOutlined />,
            label: 'Dashboard',
        },
        hasPermission('tasks', 'read') && {
            key: '/my-tasks',
            icon: <CheckSquareOutlined />,
            label: 'Minhas Tasks',
        },
        hasPermission('projects', 'read') && {
            key: '/projects',
            icon: <ProjectOutlined />,
            label: 'Projetos e Sprints',
        },
        // Security Module Group
        (hasPermission('users', 'read') || hasPermission('roles', 'read')) && {
            key: 'security-group',
            label: 'Segurança',
            icon: <SafetyCertificateOutlined />,
            children: [
                hasPermission('users', 'read') && {
                    key: '/users',
                    icon: <TeamOutlined />,
                    label: 'Usuários',
                },
                hasPermission('roles', 'read') && {
                    key: '/roles',
                    icon: <SafetyCertificateOutlined />,
                    label: 'Tipos de Usuário',
                },
            ].filter(Boolean),
        },
        // Settings Module Group
        (hasPermission('audit_logs', 'read') || hasPermission('settings', 'read')) && {
            key: 'settings-group',
            label: 'Sistema',
            icon: <SettingOutlined />,
            children: [
                hasPermission('settings', 'read') && {
                    key: '/settings',
                    icon: <SettingOutlined />,
                    label: 'Configurações',
                },
                hasPermission('audit_logs', 'read') && {
                    key: '/audit-log',
                    icon: <AuditOutlined />,
                    label: 'Audit Log',
                },
            ].filter(Boolean),
        },
    ].filter(Boolean) as any[];

    const userMenuItems = [
        {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'Meu Perfil',
        },
        { type: 'divider' as const },
        {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Sair',
            danger: true,
        },
    ];

    const selectedKey = '/' + location.pathname.split('/')[1];

    // Breadcrumb: detect dynamic route params
    const matchProject = useMatch('/projects/:projectId');
    const matchBoard = useMatch('/projects/:projectId/board');
    const projectId = matchProject?.params?.projectId ?? matchBoard?.params?.projectId;

    const { data: projectData } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data.data),
        enabled: !!projectId,
        staleTime: 5 * 60 * 1000,
    });

    const breadcrumbItems = useMemo(() => {
        const path = location.pathname;

        const nav = (to: string) => () => navigate(to);

        if (matchBoard) {
            return [
                { title: <a onClick={nav('/projects')}>Projetos e Sprints</a> },
                { title: <a onClick={nav(`/projects/${projectId}`)}>{projectData?.name ?? '...'}</a> },
                { title: 'Quadro Kanban' },
            ];
        }
        if (matchProject) {
            return [
                { title: <a onClick={nav('/projects')}>Projetos e Sprints</a> },
                { title: projectData?.name ?? '...' },
            ];
        }

        const staticRoutes: Record<string, { title: string; group?: string }> = {
            '/dashboard':  { title: 'Dashboard' },
            '/my-tasks':   { title: 'Minhas Tasks' },
            '/projects':   { title: 'Projetos e Sprints' },
            '/users':      { title: 'Usuários',          group: 'Segurança' },
            '/roles':      { title: 'Tipos de Usuário',  group: 'Segurança' },
            '/settings':   { title: 'Configurações',     group: 'Sistema' },
            '/audit-log':  { title: 'Audit Log',         group: 'Sistema' },
        };

        const route = staticRoutes[path];
        if (!route) return [];

        const items = [];
        if (route.group) items.push({ title: route.group });
        items.push({ title: route.title });
        return items;
    }, [location.pathname, matchProject, matchBoard, projectId, projectData, navigate]);

    return (
        <Layout className="app-layout">
            <Sider
                className="app-sider"
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                trigger={null}
                width={240}
                collapsedWidth={80}
            >
                <div className={`sider-logo ${collapsed ? 'collapsed' : ''}`}>
                    {collapsed ? (
                        <img src="/logo_small.png" alt="Inova Logo" />
                    ) : (
                        <img src="/logo.png" alt="Inova Logo" />
                    )}
                </div>
                <div className="sider-menu">
                    <Menu
                        mode="inline"
                        selectedKeys={[selectedKey]}
                        items={menuItems}
                        onClick={({ key }) => navigate(key)}
                    />
                </div>
            </Sider>
            <Layout>
                <Header className="app-header">
                    <div className="header-left">
                        {collapsed ? (
                            <MenuUnfoldOutlined onClick={() => setCollapsed(false)} style={{ fontSize: 18, cursor: 'pointer' }} />
                        ) : (
                            <MenuFoldOutlined onClick={() => setCollapsed(true)} style={{ fontSize: 18, cursor: 'pointer' }} />
                        )}
                    </div>
                    <div className="header-right">
                        <Switch
                            checkedChildren={<MoonOutlined />}
                            unCheckedChildren={<BulbOutlined />}
                            checked={theme === 'dark'}
                            onChange={toggleTheme}
                        />
                        <Dropdown
                            menu={{
                                items: userMenuItems,
                                onClick: ({ key }) => {
                                    if (key === 'logout') handleLogout();
                                },
                            }}
                            placement="bottomRight"
                        >
                            <Space style={{ cursor: 'pointer' }}>
                                <Avatar
                                    size={36}
                                    src={user?.avatarUrl}
                                    icon={<UserOutlined />}
                                    style={{ backgroundColor: 'var(--primary)' }}
                                />
                                <div style={{ lineHeight: 1.2 }}>
                                    <Text strong style={{ display: 'block', fontSize: 13, color: 'var(--text-main)' }}>{user?.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user?.role.name}</Text>
                                </div>
                            </Space>
                        </Dropdown>
                    </div>
                </Header>
                <Content className="app-content">
                    {breadcrumbItems.length > 0 && (
                        <Breadcrumb
                            items={breadcrumbItems}
                            style={{ marginBottom: 16, fontSize: 13 }}
                        />
                    )}
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}
