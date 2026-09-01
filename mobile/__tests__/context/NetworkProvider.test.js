import React from 'react';
import { create } from 'react-test-renderer';
import { Text } from 'react-native';
import { NetworkProvider, useNetwork } from '../../src/context/NetworkProvider';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

function NetworkConsumer() {
  const { isOnline } = useNetwork();
  return <Text testID="network">{isOnline ? 'online' : 'offline'}</Text>;
}

describe('NetworkProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides isOnline=true by default', () => {
    const tree = create(
      <NetworkProvider>
        <NetworkConsumer />
      </NetworkProvider>
    );

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('online');
  });

  it('registers a NetInfo listener', () => {
    const NetInfo = require('@react-native-community/netinfo');

    create(
      <NetworkProvider>
        <NetworkConsumer />
      </NetworkProvider>
    );

    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
    expect(typeof NetInfo.addEventListener.mock.calls[0][0]).toBe('function');
  });

  it('useNetwork() returns isOnline inside provider', () => {
    const tree = create(
      <NetworkProvider>
        <NetworkConsumer />
      </NetworkProvider>
    );

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('online');
    expect(json).not.toContain('offline');
  });

  it('renders children correctly', () => {
    const tree = create(
      <NetworkProvider>
        <Text testID="child">Hello</Text>
      </NetworkProvider>
    );

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Hello');
  });
});
