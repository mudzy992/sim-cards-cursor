import { Flex, Spin } from 'antd';

export function LoadingSpinner() {
  return (
    <Flex align="center" justify="center" style={{ minHeight: '40vh' }}>
      <Spin size="large" />
    </Flex>
  );
}
