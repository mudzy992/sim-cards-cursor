import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Space } from 'antd';
import { translateCurrent } from '@/i18n/standalone';

interface PageErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  onGoHome?: () => void;
}

interface PageErrorBoundaryState {
  hasError: boolean;
}

export class PageErrorBoundary extends Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PageErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: PageErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[PageErrorBoundary]', error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={translateCurrent('layout.errorBoundary.title')}
          subTitle={translateCurrent('layout.errorBoundary.subtitle')}
          extra={
            <Space>
              <Button type="primary" onClick={this.handleReset}>
                {translateCurrent('layout.errorBoundary.retry')}
              </Button>
              {this.props.onGoHome ? (
                <Button onClick={this.props.onGoHome}>
                  {translateCurrent('layout.errorBoundary.backHome')}
                </Button>
              ) : null}
            </Space>
          }
        />
      );
    }

    return this.props.children;
  }
}
