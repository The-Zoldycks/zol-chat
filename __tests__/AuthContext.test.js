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

describe('AuthContext', () => {
  it('provides loading state initially', () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    expect(getByTestId('loading').props.children).toBe('loaded');
  });
});