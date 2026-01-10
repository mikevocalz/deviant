import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Text style={styles.greeting}>Hello</Text>
          <Text style={styles.world}>World</Text>
          <View style={styles.accent} />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    fontSize: 56,
    fontWeight: "300",
    color: "#ffffff",
    letterSpacing: 4,
  },
  world: {
    fontSize: 72,
    fontWeight: "700",
    color: "#e94560",
    letterSpacing: 2,
    marginTop: -8,
  },
  accent: {
    width: 60,
    height: 4,
    backgroundColor: "#e94560",
    borderRadius: 2,
    marginTop: 24,
  },
});
