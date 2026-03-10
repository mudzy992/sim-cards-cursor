import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="404"
      subTitle="Stranica nije pronađena."
      extra={<Button onClick={() => navigate('/dashboard')}>Dashboard</Button>}
    />
  );
}
