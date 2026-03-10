import { Breadcrumb as AntBreadcrumb } from 'antd';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export function Breadcrumb() {
  const location = useLocation();

  const items = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);

    if (parts.length === 0) {
      return [{ title: 'Početna' }];
    }

    return parts.map((part) => ({
      title: part.charAt(0).toUpperCase() + part.slice(1),
    }));
  }, [location.pathname]);

  return <AntBreadcrumb items={items} className="mb-4" />;
}
