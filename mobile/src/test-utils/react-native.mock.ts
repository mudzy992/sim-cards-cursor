import React from 'react';

type GenericProps = Record<string, unknown> & {
  children?: React.ReactNode;
  style?: unknown;
  disabled?: boolean;
};

function makeHostComponent(name: string) {
  return function MockHostComponent(props: GenericProps) {
    const resolvedStyle =
      typeof props.style === 'function'
        ? (props.style as (state: { pressed: boolean }) => unknown)({
            pressed: false,
          })
        : props.style;
    const resolvedChildren =
      typeof props.children === 'function'
        ? (props.children as (state: { pressed: boolean }) => React.ReactNode)({
            pressed: false,
          })
        : props.children;

    return React.createElement(
      name,
      { ...props, style: resolvedStyle },
      resolvedChildren,
    );
  };
}

export const View = makeHostComponent('View');
export const Text = makeHostComponent('Text');
export const TextInput = makeHostComponent('TextInput');
export const Pressable = makeHostComponent('Pressable');
export const TouchableOpacity = makeHostComponent('TouchableOpacity');
export const ScrollView = makeHostComponent('ScrollView');
export const Image = makeHostComponent('Image');
export const ActivityIndicator = makeHostComponent('ActivityIndicator');
export const KeyboardAvoidingView = makeHostComponent('KeyboardAvoidingView');
export const Switch = makeHostComponent('Switch');
export const Modal = makeHostComponent('Modal');
export const RefreshControl = makeHostComponent('RefreshControl');

export function FlatList<T>({
  data = [],
  renderItem,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
}: {
  data?: T[];
  renderItem?: (info: { item: T; index: number }) => React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
}) {
  return React.createElement(
    'FlatList',
    null,
    ListHeaderComponent,
    data.length > 0 && renderItem
      ? data.map((item, index) =>
          React.createElement(
            React.Fragment,
            { key: String(index) },
            renderItem({ item, index }),
          ),
        )
      : ListEmptyComponent,
    ListFooterComponent,
  );
}

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  hairlineWidth: 1,
  absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  absoluteFillObject: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  flatten: (style: unknown) => style,
};

export const Alert = {
  alert: jest.fn(),
};

export const Linking = {
  openURL: jest.fn(async () => true),
  canOpenURL: jest.fn(async () => true),
};

export const Platform = {
  OS: 'android' as const,
  select: <T>(spec: { android?: T; ios?: T; default?: T }): T | undefined =>
    spec.android ?? spec.default,
};

export const NativeModules: Record<string, unknown> = {};

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
};

export const Appearance = {
  getColorScheme: () => 'light' as const,
  addChangeListener: () => ({ remove: jest.fn() }),
};

export const Vibration = {
  vibrate: jest.fn(),
};

export const Animated = {
  Value: class {
    constructor(public value: number) {}
    setValue(next: number) {
      this.value = next;
    }
    stopAnimation() {}
    interpolate() {
      return 0;
    }
  },
  View: makeHostComponent('AnimatedView'),
  timing: () => ({ start: jest.fn() }),
  sequence: () => ({ start: jest.fn() }),
  loop: () => ({ start: jest.fn(), stop: jest.fn() }),
};
