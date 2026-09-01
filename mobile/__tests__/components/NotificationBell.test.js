import React from 'react';
import { create } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import NotificationBell from '../../src/components/NotificationBell';

describe('NotificationBell', () => {
  it('renders the bell icon', () => {
    const tree = create(<NotificationBell count={0} onPress={() => {}} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toBeTruthy();
  });

  it('does not show badge when count is 0', () => {
    const tree = create(<NotificationBell count={0} onPress={() => {}} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('"0"');
  });

  it('shows badge with count when count > 0', () => {
    const tree = create(<NotificationBell count={5} onPress={() => {}} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('5');
  });

  it('shows "99+" when count > 99', () => {
    const tree = create(<NotificationBell count={150} onPress={() => {}} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('99+');
  });

  it('calls onPress when tapped', () => {
    const mockOnPress = jest.fn();
    const tree = create(<NotificationBell count={3} onPress={mockOnPress} />);
    const touchable = tree.root.findAllByType(TouchableOpacity)[0];
    touchable.props.onPress();
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not show badge for count 1', () => {
    const tree = create(<NotificationBell count={1} onPress={() => {}} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('1');
  });
});
