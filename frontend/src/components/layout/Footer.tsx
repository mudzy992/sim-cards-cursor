import { Layout, Typography } from 'antd';

const { Footer: AntFooter } = Layout;

export function Footer() {
  return (
    <AntFooter className="!bg-transparent !text-center">
      <Typography.Text type="secondary">
        SIM Tracker - Phase 1 Foundation
      </Typography.Text>
    </AntFooter>
  );
}
