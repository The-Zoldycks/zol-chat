import { render } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import React from 'react';
import { View, Text } from 'react-native';

const TestComponent = () => {
  const { user, profile, loading } = useAuth();
  return (
    <View testID="auth-state">
      <Text testID="loading">{loading ? 'loading' : 'loaded'}</Text>
      <Text testID="user">{user ? user.uid : 'null'}</Text>
      <Text testID="profile">{profile ? profile.username : 'null'}</Text>
    </View>
  );
};

const BadComponent = () => {
  useAuth();
  return <Text>should not render</Text>;
};

describe('AuthContext', () => {
  it('provides loading state initially', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(getByTestId('loading').props.children).toBe('loaded');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});