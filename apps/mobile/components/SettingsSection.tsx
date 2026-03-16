import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SettingsSectionProps {
  label: string;
  children: React.ReactNode;
}

export function SettingsSection({ label, children }: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.groupedRows}>{children}</View>
    </View>
  );
}

interface SettingsRowProps {
  children: React.ReactNode;
  isLast?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function SettingsRow({ children, isLast, disabled, testID }: SettingsRowProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        !isLast && styles.rowBorderBottom,
        disabled && styles.rowDisabled,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
