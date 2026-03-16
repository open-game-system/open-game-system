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

export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [soundsOn, setSoundsOn] = useState(true);
  const [devMode, setDevMode] = useState(false);
  const [debugOn, setDebugOn] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const [notifStatus, devModeVal, debugVal, soundsVal] = await Promise.all([
        Notifications.getPermissionsAsync(),
        isDeveloperMode(),
        isDebugOverlay(),
        isSoundsEnabled(),
      ]);
      setPushEnabled(notifStatus.status === 'granted');
      setDevMode(devModeVal);
      setDebugOn(debugVal);
      setSoundsOn(soundsVal);
    };
    loadSettings();
  }, []);

  const handleTogglePush = useCallback(async (value: boolean) => {
    setPushEnabled(value);
    // Note: toggling push off in-app doesn't revoke system permission.
    // This would need to open system settings or unregister the push token.
  }, []);

  const handleToggleSounds = useCallback(async (value: boolean) => {
    setSoundsOn(value);
    await setSoundsEnabled(value);
  }, []);

  const handleToggleDevMode = useCallback(
    async (value: boolean) => {
      setDevMode(value);
      await setDeveloperMode(value);
      if (!value) {
        setDebugOn(false);
      }
    },
    []
  );

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
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.groupedRows}>
            <View style={[styles.row, styles.rowBorderBottom]}>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Switch
                testID="pushNotificationsToggle"
                value={pushEnabled}
                onValueChange={handleTogglePush}
                trackColor={{ false: '#2a2a40', true: '#A855F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Sounds</Text>
              <Switch
                testID="soundsToggle"
                value={soundsOn}
                onValueChange={handleToggleSounds}
                trackColor={{ false: '#2a2a40', true: '#A855F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Developer */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Developer</Text>
          <View style={styles.groupedRows}>
            <View style={[styles.row, styles.rowBorderBottom]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Developer Mode</Text>
                <Text style={styles.rowHint}>Load custom game URLs</Text>
              </View>
              <Switch
                testID="developerModeToggle"
                value={devMode}
                onValueChange={handleToggleDevMode}
                trackColor={{ false: '#2a2a40', true: '#A855F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View
              testID={`debugOverlayRow-${devMode ? 'enabled' : 'disabled'}`}
              style={[styles.row, !devMode && styles.rowDisabled]}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel}>Debug Overlay</Text>
                <Text style={styles.rowHint}>
                  Bridge state, device ID, tokens
                </Text>
              </View>
              <Switch
                testID="debugOverlayToggle"
                value={debugOn}
                onValueChange={handleToggleDebug}
                disabled={!devMode}
                trackColor={{ false: '#2a2a40', true: '#A855F6' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Developer Tools button (visible when dev mode is on) */}
        {devMode && (
          <View style={styles.section}>
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
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.groupedRows}>
            <View style={[styles.row, styles.rowBorderBottom]}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <TouchableOpacity style={[styles.row, styles.rowBorderBottom]}>
              <Text style={styles.rowLabel}>Open Game System</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.row}>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E8E8ED',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 18,
    color: '#8888A0',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8888A0',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  groupedRows: {
    backgroundColor: '#141420',
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1C1C2E',
  },
  rowDisabled: {
    opacity: 0.4,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E8E8ED',
  },
  rowHint: {
    fontSize: 12,
    color: '#8888A0',
  },
  rowValue: {
    fontSize: 15,
    color: '#8888A0',
  },
  chevron: {
    fontSize: 22,
    color: '#8888A0',
    fontWeight: '300',
  },
  devToolsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#141420',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  devToolsButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#A855F6',
  },
});
