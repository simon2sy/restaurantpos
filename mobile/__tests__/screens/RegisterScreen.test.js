import React from 'react';
import { create, act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import RegisterScreen from '../../src/screens/auth/RegisterScreen';
import { useAuth } from '../../src/context/AuthContext';

jest.mock('../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockGoBack = jest.fn();
const mockRegister = jest.fn();

const defaultAuth = {
  user: null,
  loading: false,
  isLoggedIn: false,
  login: jest.fn(),
  register: mockRegister,
  logout: jest.fn(),
  hasRole: jest.fn(),
};

describe('RegisterScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuth.mockReturnValue(defaultAuth);
  });

  it('renders all form fields', () => {
    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Your full name');
    expect(json).toContain('Choose a username');
    expect(json).toContain('Min 10 characters');
    expect(json).toContain('Repeat password');
  });

  it('renders Create Account title', () => {
    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Create Account');
  });

  it('shows "Already have an account?" link', () => {
    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Already have an account');
  });

  it('calls register with form data', async () => {
    mockRegister.mockResolvedValue({ username: 'newuser' });

    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const inputs = tree.root.findAllByType(TextInput);

    await act(async () => {
      inputs[0].props.onChangeText('John Doe');
      inputs[1].props.onChangeText('johndoe');
      inputs[2].props.onChangeText('SecurePass123');
      inputs[3].props.onChangeText('SecurePass123');
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    const signUpBtn = touchables.find((t) =>
      t.findAllByType(Text).some((tt) => {
        const c = typeof tt.props.children === 'string' ? tt.props.children : '';
        return c.includes('Sign Up');
      })
    );

    if (signUpBtn) {
      await act(async () => {
        signUpBtn.props.onPress();
      });
      expect(mockRegister).toHaveBeenCalledWith({
        full_name: 'John Doe',
        username: 'johndoe',
        password: 'SecurePass123',
        password2: 'SecurePass123',
      });
    }
  });

  it('shows error when fields are empty', async () => {
    jest.spyOn(Alert, 'alert');

    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const touchables = tree.root.findAllByType(TouchableOpacity);
    const signUpBtn = touchables.find((t) =>
      t.findAllByType(Text).some((tt) => {
        const c = typeof tt.props.children === 'string' ? tt.props.children : '';
        return c.includes('Sign Up');
      })
    );

    if (signUpBtn) {
      await act(async () => {
        signUpBtn.props.onPress();
      });
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all fields.');
    }

    Alert.alert.mockRestore();
  });

  it('shows error when passwords do not match', async () => {
    jest.spyOn(Alert, 'alert');

    const tree = create(<RegisterScreen navigation={{ goBack: mockGoBack }} />);
    const inputs = tree.root.findAllByType(TextInput);

    await act(async () => {
      inputs[0].props.onChangeText('John');
      inputs[1].props.onChangeText('john');
      inputs[2].props.onChangeText('Password123');
      inputs[3].props.onChangeText('DifferentPass');
    });

    const touchables = tree.root.findAllByType(TouchableOpacity);
    const signUpBtn = touchables.find((t) =>
      t.findAllByType(Text).some((tt) => {
        const c = typeof tt.props.children === 'string' ? tt.props.children : '';
        return c.includes('Sign Up');
      })
    );

    if (signUpBtn) {
      await act(async () => {
        signUpBtn.props.onPress();
      });
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Passwords do not match.');
    }

    Alert.alert.mockRestore();
  });
});
