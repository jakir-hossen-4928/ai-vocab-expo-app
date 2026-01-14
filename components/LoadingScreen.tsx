import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");

export const LoadingScreen = () => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const iconY = useSharedValue(0);
  const glowOpacity = useSharedValue(0.2);

  useEffect(() => {
    // Entrance animations
    opacity.value = withTiming(1, { duration: 1000 });
    scale.value = withSpring(1, { damping: 12, stiffness: 90 });

    // Floating icon animation
    iconY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Glow pulsing
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 2000 }),
        withTiming(0.2, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [
      { scale: interpolate(glowOpacity.value, [0.2, 0.5], [1, 1.2]) },
    ],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#020617", "#0f172a", "#1e293b"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.content, animatedStyle]}>
        <View style={styles.brandContainer}>
          <Animated.View style={[styles.glow, glowStyle]} />

          <Animated.View style={[styles.iconWrapper, iconStyle]}>
            <Ionicons name="book" size={80} color="#38bdf8" />
          </Animated.View>

          <View style={styles.textContainer}>
            <Text style={styles.brandName}>Ai Vocab</Text>
            <View style={styles.accentLine} />
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <View style={styles.loadingTextContainer}>
            <Text style={styles.loadingTitle}>Personalizing Your Journey</Text>
            <Text style={styles.loadingSubtitle}>
              Optimizing database for peak performance...
            </Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
        <Text style={styles.poweredBy}>Powered by Ai Vocab.app</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 100,
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    top: -60,
  },
  iconWrapper: {
    marginBottom: 20,
    shadowColor: "#38bdf8",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  textContainer: {
    alignItems: "center",
  },
  brandName: {
    fontSize: 56,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  accentLine: {
    width: 100,
    height: 5,
    backgroundColor: "#38bdf8",
    borderRadius: 3,
    marginTop: 5,
  },
  loadingContainer: {
    alignItems: "center",
    width: "100%",
  },
  loadingTextContainer: {
    marginTop: 30,
    alignItems: "center",
  },
  loadingTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  loadingSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  poweredBy: {
    fontSize: 10,
    color: "#334155",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
