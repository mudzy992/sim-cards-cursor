import { Layout, Typography } from 'antd';

const { Footer: AntFooter } = Layout;

export function Footer() {
  return (
    <AntFooter className="!bg-transparent !text-center">
      <Typography.Text type="secondary">
        SIM Tracker - V1 - 12.03.2026.
      </Typography.Text>
    </AntFooter>
  );
}
