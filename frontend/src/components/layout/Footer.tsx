import { Layout, Typography } from 'antd';
import { appVersion, formattedAppBuildDate } from '@/config/app-version';

const { Footer: AntFooter } = Layout;

export function Footer() {
  return (
    <AntFooter className="!bg-transparent !text-center">
      <Typography.Text type="secondary">
        {`SIM Tracker - v${appVersion} - ${formattedAppBuildDate}.`}
      </Typography.Text>
    </AntFooter>
  );
}
