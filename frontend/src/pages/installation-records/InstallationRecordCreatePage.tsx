import { useNavigate } from 'react-router-dom';
import InstallationRecordCreateForm from '@/components/installation-records/InstallationRecordCreateForm';

export default function InstallationRecordCreatePage() {
  const navigate = useNavigate();

  return (
    <InstallationRecordCreateForm
      onSuccess={(record) => navigate(`/installation-records/${record.id}`)}
    />
  );
}
