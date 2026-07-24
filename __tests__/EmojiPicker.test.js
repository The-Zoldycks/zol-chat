import { render, fireEvent } from '@testing-library/react-native';
import EmojiPicker from '../src/components/EmojiPicker';
import { darkColors } from '../src/theme/theme';
import React from 'react';

describe('EmojiPicker', () => {
  it('renders with search bar and category tabs', () => {
    const { getByPlaceholderText } = render(<EmojiPicker onSelect={() => {}} colors={darkColors} />);
    expect(getByPlaceholderText('Search emoji...')).toBeTruthy();
  });

  it('calls onSelect when an emoji is pressed', () => {
    const onSelect = jest.fn();
    const { getByText } = render(<EmojiPicker onSelect={onSelect} colors={darkColors} />);
    const emoji = getByText('😀');
    fireEvent.press(emoji);
    expect(onSelect).toHaveBeenCalledWith('😀');
  });
});
