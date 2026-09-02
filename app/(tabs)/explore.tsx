import { useState } from 'react';
import { StyleSheet, Pressable } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabTwoScreen() {
  const [count, setCount] = useState(0);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="plus"
          style={styles.headerImage}
        />
      }>

      <ThemedView style={styles.container}>
        <ThemedText type="title">
          Counter App
        </ThemedText>

        <ThemedText style={styles.countText}>
          {count}
        </ThemedText>

        <Pressable
          style={styles.button}
          onPress={() => setCount(prev => prev + 1)}>

          <ThemedText style={styles.buttonText}>
            Increase
          </ThemedText>

        </Pressable>
      </ThemedView>

    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },

  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 20,
  },

  countText: {
    fontSize: 48,
    fontWeight: 'bold',
  },

  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
  },

  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});