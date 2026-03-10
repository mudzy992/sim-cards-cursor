import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { LoginInput } from '@/types/auth.types';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: LoginInput) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const loggedInUser = await login(values);
      const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname;
      const allowedForUser =
        fromPath === '/dashboard' ||
        fromPath?.startsWith('/installation-records');
      const safePath =
        loggedInUser.role === 'USER'
          ? allowedForUser
            ? fromPath
            : '/dashboard'
          : fromPath ?? '/dashboard';
      navigate(safePath ?? '/dashboard', { replace: true });
    } catch {
      setErrorMessage('Prijava nije uspjela. Provjeri kredencijale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md shadow-sm">
        <Typography.Title level={3}>Prijava</Typography.Title>
        <Typography.Paragraph type="secondary">
          Unesite pristupne podatke za SIM Tracker.
        </Typography.Paragraph>

        {errorMessage ? (
          <Alert type="error" message={errorMessage} className="mb-4" />
        ) : null}

        <Form<LoginInput> layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <Form.Item
            label="Email ili korisničko ime"
            name="emailOrUsername"
            rules={[{ required: true, message: 'Unesite email ili korisničko ime' }]}
          >
            <Input
              placeholder="email@example.com ili ime.prezime"
              autoComplete="username"
            />
          </Form.Item>
          <Form.Item
            label="Lozinka"
            name="password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button htmlType="submit" type="primary" loading={isSubmitting} block>
            Prijavi se
          </Button>
        </Form>
      </Card>
    </div>
  );
}
