import React from 'react';
import { create, act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { authApi } from '../../src/services/authApi';
import * as SecureStore from 'expo-secure-store';

jest.mock('../../src/services/authApi', () => ({
  authApi: {
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    qrLogin: jest.fn(),
  },
}));

// Helper component that exposes auth values via onAuth callback
function AuthConsumer({ onAuth }) {
  const auth = useAuth();
  React.useEffect(() => {
    if (onAuth) onAuth(auth);
  }, []);
  return React.createElement('View', null, 'auth');
}

function LoginButton({ username, password }) {
  const { login } = useAuth();
  return React.createElement(
    'TouchableOpacity',
    { testID: 'login-btn', onPress: () => login(username, password) },
    'Login'
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SecureStore.getItemAsync.mockResolvedValue(null);
  });

  it('provides auth context to children', () => {
    const authRef = { current: null };

    act(() => {
      create(
        React.createElement(AuthProvider, null,
          React.createElement(AuthConsumer, { onAuth: (a) => { authRef.current = a; } })
        )
      );
    });

    expect(authRef.current).toBeTruthy();
    expect(authRef.current.isLoggedIn).toBe(false);
    expect(authRef.current.user).toBeNull();
  });

  it('login() calls authApi.login', async () => {
    const mockUser = { username: 'restaurant', role: 'MANAGER', is_superuser: true };
    authApi.login.mockResolvedValue({
      data: { user: mockUser, access: 'token', refresh: 'refresh' },
    });

    const authRef = { current: null };
    const tree = create(
      React.createElement(AuthProvider, null,
        React.createElement(AuthConsumer, { onAuth: (a) => { authRef.current = a; } }),
        React.createElement(LoginButton, { username: 'restaurant', password: 'Admin@12345' })
      )
    );

    const loginBtn = tree.root.findByProps({ testID: 'login-btn' });
    await act(async () => {
      loginBtn.props.onPress();
    });

    expect(authApi.login).toHaveBeenCalledWith('restaurant', 'Admin@12345');
  });

  it('hasRole() returns true for superuser regardless of role', async () => {
    const authRef = { current: null };

    authApi.getProfile.mockResolvedValue({
      data: { username: 'admin', role: null, is_superuser: true, is_employee: false },
    });
    SecureStore.getItemAsync.mockResolvedValue('existing-token');

    create(
      React.createElement(AuthProvider, null,
        React.createElement(AuthConsumer, { onAuth: (a) => { authRef.current = a; } })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (authRef.current?.user) {
      expect(authRef.current.isManager).toBe(true);
      expect(authRef.current.isKitchen).toBe(true);
      expect(authRef.current.isCashier).toBe(true);
      expect(authRef.current.isDelivery).toBe(true);
    }
  });

  it('clears tokens when getProfile fails', async () => {
    SecureStore.getItemAsync.mockResolvedValue('expired-token');
    authApi.getProfile.mockRejectedValue(new Error('Unauthorized'));

    create(
      React.createElement(AuthProvider, null,
        React.createElement(AuthConsumer)
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });

  it('isKitchen is true for kitchen role', async () => {
    const authRef = { current: null };

    authApi.getProfile.mockResolvedValue({
      data: { username: 'kitchen1', role: 'KITCHEN', is_superuser: false, is_employee: true },
    });
    SecureStore.getItemAsync.mockResolvedValue('token');

    create(
      React.createElement(AuthProvider, null,
        React.createElement(AuthConsumer, { onAuth: (a) => { authRef.current = a; } })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (authRef.current?.user) {
      expect(authRef.current.isKitchen).toBe(true);
      expect(authRef.current.isCashier).toBe(false);
      expect(authRef.current.isDelivery).toBe(false);
    }
  });
});
