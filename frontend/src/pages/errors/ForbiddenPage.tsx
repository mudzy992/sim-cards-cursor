import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="403"
      title="403"
      subTitle="Nemate dozvolu za ovu stranicu."
      extra={<Button onClick={() => navigate('/dashboard')}>Nazad na dashboard</Button>}
    />
  );
}
