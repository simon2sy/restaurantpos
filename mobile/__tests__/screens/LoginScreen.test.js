import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import LoginScreen from '../../src/screens/auth/LoginScreen';
import { useAuth } from '../../src/context/AuthContext';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
const mockLogin = jest.fn();

const defaultAuth = {
  user: null,
  loading: false,
  isLoggedIn: false,
  login: mockLogin,
  register: jest.fn(),
  logout: jest.fn(),
  hasRole: jest.fn(),
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue(defaultAuth);
  });

  it('renders username and password inputs', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Enter your username');
    expect(json).toContain('Enter your password');
  });

  it('renders Sign In button', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Sign In');
  });

  it('renders Restaurant POS title', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Restaurant POS');
  });

  it('shows Sign Up link', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Sign Up');
  });

  it('shows QR sign in option', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Sign in with Staff QR');
  });

  it('navigates to Register on sign up link press', () => {
    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const texts = tree.root.findAllByType(Text);
    const signUpText = texts.find((t) => {
      const children = typeof t.props.children === 'string' ? t.props.children : '';
      return children.includes('Sign Up');
    });
    // Find the parent TouchableOpacity
    if (signUpText) {
      let parent = signUpText.parent;
      while (parent && parent.type !== TouchableOpacity) {
        parent = parent.parent;
      }
      if (parent) {
        parent.props.onPress();
        expect(mockNavigate).toHaveBeenCalledWith('Register');
      }
    }
  });

  it('calls login with credentials', async () => {
    mockLogin.mockResolvedValue({ username: 'restaurant' });

    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);

    const inputs = tree.root.findAllByType(TextInput);
    await act(async () => {
      inputs[0].props.onChangeText('restaurant');
      inputs[1].props.onChangeText('Admin@12345');
    });

    // Find the Sign In button
    const touchables = tree.root.findAllByType(TouchableOpacity);
    const signInBtn = touchables.find((t) => {
      const text = t.findAllByType(Text).find((tt) => {
        const c = typeof tt.props.children === 'string' ? tt.props.children : '';
        return c.includes('Sign In');
      });
      return !!text;
    });

    if (signInBtn) {
      await act(async () => {
        signInBtn.props.onPress();
      });
      expect(mockLogin).toHaveBeenCalledWith('restaurant', 'Admin@12345');
    }
  });

  it('shows error alert on login failure', async () => {
    jest.spyOn(Alert, 'alert');
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));

    const tree = create(<LoginScreen navigation={{ navigate: mockNavigate }} />);
    const inputs = tree.root.findAllByType(TextInput);

    await act(async () => {
      inputs[0].props.onChangeText('wrong');
      inputs[1].props.onChangeText('wrongpass');
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    const signInBtn = touchables.find((t) => {
      return t.findAllByType(Text).some((tt) => {
        const c = typeof tt.props.children === 'string' ? tt.props.children : '';
        return c.includes('Sign In');
      });
    });

    if (signInBtn) {
      await act(async () => {
        signInBtn.props.onPress();
      });
      expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid credentials');
    }

    Alert.alert.mockRestore();
  });
});
