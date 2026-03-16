import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  isDeveloperMode,
  setDeveloperMode,
  isDebugOverlay,
  setDebugOverlay,
  isSoundsEnabled,
  setSoundsEnabled,
} from '../services/settings';
import { SettingsSection, SettingsRow } from '../components/SettingsSection';

const TRACK_COLORS = { false: '#2a2a40', true: '#A855F6' } as const;

export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [debugOn, setDebugOn] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [notif, dev, debug, sounds] = await Promise.all([
        Notifications.getPermissionsAsync(),
        isDeveloperMode(),
        isDebugOverlay(),
        isSoundsEnabled(),
      ]);
      setPushEnabled(notif.status === 'granted');
      setDevMode(dev);
      setDebugOn(debug);
      setSoundsOn(sounds);
    };
    load();
  }, []);

  const handleTogglePush = useCallback((value: boolean) => {
    setPushEnabled(value);
  }, []);

  const handleToggleSounds = useCallback(async (value: boolean) => {
    setSoundsOn(value);
    await setSoundsEnabled(value);
  }, []);

  const handleToggleDevMode = useCallback(async (value: boolean) => {
    setDevMode(value);
    await setDeveloperMode(value);
    if (!value) setDebugOn(false);
  }, []);

  const handleToggleDebug = useCallback(async (value: boolean) => {
    setDebugOn(value);
    await setDebugOverlay(value);
  }, []);

  return (
    <View style={styles.container} testID="settingsScreen">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <TouchableOpacity
            testID="settingsCloseButton"
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <SettingsSection label="Notifications">
          <SettingsRow>
            <Text style={styles.rowLabel}>Push Notifications</Text>
            <Switch
              testID="pushNotificationsToggle"
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={TRACK_COLORS}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
          <SettingsRow isLast>
            <Text style={styles.rowLabel}>Sounds</Text>
            <Switch
              testID="soundsToggle"
              value={soundsOn}
              onValueChange={handleToggleSounds}
              trackColor={TRACK_COLORS}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Developer */}
        <SettingsSection label="Developer">
          <SettingsRow>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Developer Mode</Text>
              <Text style={styles.rowHint}>Load custom game URLs</Text>
            </View>
            <Switch
              testID="developerModeToggle"
              value={devMode}
              onValueChange={handleToggleDevMode}
              trackColor={TRACK_COLORS}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
          <SettingsRow
            isLast
            disabled={!devMode}
            testID={`debugOverlayRow-${devMode ? 'enabled' : 'disabled'}`}
          >
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>Debug Overlay</Text>
              <Text style={styles.rowHint}>Bridge state, device ID, tokens</Text>
            </View>
            <Switch
              testID="debugOverlayToggle"
              value={debugOn}
              onValueChange={handleToggleDebug}
              disabled={!devMode}
              trackColor={TRACK_COLORS}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
        </SettingsSection>

        {/* Developer Tools */}
        {devMode && (
          <View style={styles.sectionNoBg}>
            <TouchableOpacity
              testID="openDevToolsButton"
              style={styles.devToolsButton}
              onPress={() => router.push('/dev-tools')}
            >
              <Text style={styles.devToolsButtonText}>Open Developer Tools</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* About */}
        <SettingsSection label="About">
          <SettingsRow>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </SettingsRow>
          <SettingsRow>
            <Text style={styles.rowLabel}>Open Game System</Text>
            <Text style={styles.chevron}>›</Text>
          </SettingsRow>
          <SettingsRow isLast>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </SettingsRow>
        </SettingsSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 50,
  },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#E8E8ED', letterSpacing: -0.5 },
  closeButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  closeText: { fontSize: 18, color: '#8888A0' },
  rowInfo: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: '#E8E8ED' },
  rowHint: { fontSize: 12, color: '#8888A0' },
  rowValue: { fontSize: 15, color: '#8888A0' },
  chevron: { fontSize: 22, color: '#8888A0', fontWeight: '300' },
  sectionNoBg: { paddingHorizontal: 24, marginBottom: 24 },
  devToolsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141420',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  devToolsButtonText: { fontSize: 15, fontWeight: '500', color: '#A855F6' },
});
