import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import api, { tokenManager } from '../services/api';

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuthStore();

    const onFinish = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            const res = await api.post('/auth/login', values);
            // refreshToken fica em httpOnly cookie (gerenciado pelo backend, RNF-008)
            // accessToken fica em memória (tokenManager) — nunca em localStorage
            const { accessToken, user } = res.data.data;
            tokenManager.set(accessToken);
            login(user);
            message.success(`Bem-vindo, ${user.name}!`);

            if (user.firstLogin) {
                navigate('/change-password');
            } else {
                navigate('/');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Erro ao fazer login';
            message.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card fade-in">
                <div className="login-logo">
                    <img src="/logo.png" alt="Inova Logo" />
                </div>

                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                    size="large"
                    requiredMark={false}
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Informe seu email' },
                            { type: 'email', message: 'Email inválido' },
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined style={{ color: '#6366f1' }} />}
                            placeholder="Email"
                            autoComplete="email"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[
                            { required: true, message: 'Informe sua senha' },
                            { min: 8, message: 'Mínimo 8 caracteres' },
                        ]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: '#6366f1' }} />}
                            placeholder="Senha"
                            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 8 }}>
                        <Link to="/forgot-password" style={{ color: '#818cf8', fontSize: 13 }}>
                            Esqueci minha senha
                        </Link>
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            block
                            style={{
                                height: 44,
                                fontWeight: 600,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                border: 'none',
                            }}
                        >
                            ENTRAR
                        </Button>
                    </Form.Item>
                </Form>

                <div className="login-footer">v1.0 — Inova © 2026</div>
            </div>
        </div>
    );
}
