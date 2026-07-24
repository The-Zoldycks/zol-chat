import { chatIdFromUsers } from '../src/services/chatService';

describe('chatIdFromUsers', () => {
  it('produces a consistent ID regardless of argument order', () => {
    const id1 = chatIdFromUsers('alice', 'bob');
    const id2 = chatIdFromUsers('bob', 'alice');
    expect(id1).toBe(id2);
  });

  it('joins UIDs with double underscore', () => {
    expect(chatIdFromUsers('a', 'b')).toBe('a__b');
  });

  it('sorts UIDs alphabetically', () => {
    expect(chatIdFromUsers('zol', 'alpha')).toBe('alpha__zol');
  });

  it('handles same UID twice', () => {
    expect(chatIdFromUsers('me', 'me')).toBe('me__me');
  });
});
