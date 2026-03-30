import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import { useThemeStore } from '../store/themeStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const themeMode = useThemeStore((s) => s.theme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
    }, [themeMode]);

    const isDark = themeMode === 'dark';

    return (
        <ConfigProvider
            locale={ptBR}
            theme={{
                algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
                token: {
                    colorPrimary: isDark ? '#20b2aa' : '#16539a', // Teal for dark, Blue for light
                    colorBgContainer: isDark ? '#1e1e2e' : '#ffffff',
                    colorBgElevated: isDark ? '#252538' : '#ffffff',
                    colorBgLayout: isDark ? '#13131f' : '#f0f2f5',
                    colorBorder: isDark ? '#2d2d44' : '#d9d9d9',
                    colorText: isDark ? '#e0e0ef' : '#1f2937',
                    colorTextSecondary: isDark ? '#9090b0' : '#4b5563',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                    borderRadius: 8,
                    fontSize: 14,
                },
                components: {
                    Menu: {
                        itemBg: 'transparent',
                        itemSelectedBg: isDark ? 'rgba(32, 178, 170, 0.15)' : 'rgba(22, 83, 154, 0.1)',
                        itemSelectedColor: isDark ? '#20b2aa' : '#16539a',
                        itemHoverBg: isDark ? 'rgba(32, 178, 170, 0.08)' : 'rgba(22, 83, 154, 0.05)',
                    },
                    Card: {
                        colorBgContainer: isDark ? '#1e1e2e' : '#ffffff',
                    },
                    Table: {
                        colorBgContainer: isDark ? '#1e1e2e' : '#ffffff',
                        headerBg: isDark ? '#252538' : '#fafafa',
                    },
                    Modal: {
                        contentBg: isDark ? '#1e1e2e' : '#ffffff',
                        headerBg: isDark ? '#1e1e2e' : '#ffffff',
                    },
                    Input: {
                        colorBgContainer: isDark ? '#252538' : '#ffffff',
                    },
                    Select: {
                        colorBgContainer: isDark ? '#252538' : '#ffffff',
                    },
                },
            }}
        >
            <AntApp>
                {children}
            </AntApp>
        </ConfigProvider>
    );
}
