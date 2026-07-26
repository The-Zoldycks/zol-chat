import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, Divider, Portal, Surface, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

let alertFn = null;

export function showAlert(title, message, buttons) {
  if (alertFn) {
    alertFn({ title, message, buttons });
  }
}

export function AppAlertProvider() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));

  const styles = StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      justifyContent: 'flex-end',
      zIndex: 9999,
    },
    sheetContainer: {
      width: '100%',
    },
    surface: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: Math.max(insets.bottom + 12, 20),
      width: '100%',
      borderTopWidth: 1,
      borderColor: colors.surfaceVariant,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    handleIndicator: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceVariant,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      color: colors.onSurface,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: config?.message ? 8 : 16,
    },
    message: {
      color: colors.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    buttonColumn: {
      gap: 10,
      marginTop: 4,
    },
    button: {
      borderRadius: 14,
      paddingVertical: 2,
    },
  });

  useEffect(() => {
    alertFn = setConfig;
    return () => { alertFn = null; };
  }, []);

  useEffect(() => {
    if (config) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [config, anim]);

  const handlePress = (onPress) => {
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setConfig(null);
      if (onPress) onPress();
    });
  };

  if (!config) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <Portal>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handlePress(null)} />
        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY }] }]}>
          <Surface style={styles.surface} elevation={5}>
            <View style={styles.handleIndicator} />
            <Text style={styles.title}>{config.title}</Text>
            {config.message ? <Text style={styles.message}>{config.message}</Text> : null}
            <View style={styles.buttonColumn}>
              {config.buttons.map((btn, i) => (
                <Button
                  key={i}
                  mode={btn.style === 'destructive' ? 'contained' : btn.style === 'cancel' ? 'outlined' : 'contained'}
                  onPress={() => handlePress(btn.onPress)}
                  buttonColor={btn.style === 'destructive' ? colors.danger : btn.style === 'cancel' ? undefined : colors.primary}
                  textColor={btn.style === 'destructive' ? colors.white : btn.style === 'cancel' ? colors.onSurface : colors.background}
                  labelStyle={{ fontWeight: '600', fontSize: 15 }}
                  style={[styles.button, btn.style === 'cancel' && { borderColor: colors.surfaceVariant }]}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  {btn.text}
                </Button>
              ))}
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Portal>
  );
}
