import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  Platform,
  StatusBar as RNStatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { addRecentDevUrl, getRecentDevUrls } from "../services/dev-urls";

export default function DevToolsScreen() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("");
  const [recentUrls, setRecentUrls] = useState<string[]>([]);

  useEffect(() => {
    getRecentDevUrls().then(setRecentUrls);
  }, []);

  const handleLaunch = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    await addRecentDevUrl(fullUrl);
    router.push({
      pathname: "/game",
      params: { url: fullUrl, name: "Dev Game" },
    });
  }, [urlInput, router]);

  const handleTapRecentUrl = useCallback((url: string) => {
    setUrlInput(url);
  }, []);

  return (
    <View style={styles.container} testID="devToolsScreen">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Developer Tools</Text>
          <TouchableOpacity
            testID="devToolsCloseButton"
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Load Custom Game */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Load Custom Game</Text>
          <View style={styles.groupedRows}>
            <TextInput
              testID="devToolsUrlInput"
              style={styles.urlInput}
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://your-game.dev/"
              placeholderTextColor="#8888A0"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleLaunch}
            />
            <TouchableOpacity
              testID="devToolsLaunchButton"
              style={[styles.launchButton, !urlInput.trim() && styles.launchButtonDisabled]}
              onPress={handleLaunch}
              disabled={!urlInput.trim()}
            >
              <Text style={styles.launchButtonText}>Launch</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bridge Inspector */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bridge Inspector</Text>
          <View style={styles.inspectorCard}>
            <InspectorRow label="Device ID" value="ogs_d_—" />
            <View style={styles.divider} />
            <InspectorRow label="Push Token" value="—" />
            <View style={styles.divider} />
            <InspectorRow label="Bridge Status" value="Disconnected" valueColor="#8888A0" />
            <View style={styles.divider} />
            <InspectorRow label="Platform" value={Platform.OS} />
            <View style={styles.divider} />
            <InspectorRow label="Cast Devices" value="0 found" />
          </View>
        </View>

        {/* Recent URLs */}
        {recentUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recent URLs</Text>
            <View style={styles.groupedRows}>
              {recentUrls.map((url, i) => (
                <TouchableOpacity
                  key={url}
                  testID={`devToolsRecentUrl-${i}`}
                  style={[styles.recentUrlRow, i < recentUrls.length - 1 && styles.recentUrlBorder]}
                  onPress={() => handleTapRecentUrl(url)}
                >
                  <Text style={styles.recentUrlText} numberOfLines={1}>
                    {url}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InspectorRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.inspectorRow}>
      <Text style={styles.inspectorLabel}>{label}</Text>
      <Text style={[styles.inspectorValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 50,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#E8E8ED",
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    fontSize: 18,
    color: "#8888A0",
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8888A0",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  groupedRows: {
    backgroundColor: "#141420",
    borderRadius: 12,
    overflow: "hidden",
  },
  urlInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#E8E8ED",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1C1C2E",
  },
  launchButton: {
    backgroundColor: "#A855F6",
    paddingVertical: 14,
    alignItems: "center",
  },
  launchButtonDisabled: {
    opacity: 0.4,
  },
  launchButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  inspectorCard: {
    backgroundColor: "#141420",
    borderRadius: 12,
    paddingVertical: 4,
  },
  inspectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inspectorLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8888A0",
  },
  inspectorValue: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E8E8ED",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#1C1C2E",
    marginHorizontal: 16,
  },
  recentUrlRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recentUrlBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#1C1C2E",
  },
  recentUrlText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#E8E8ED",
  },
});
