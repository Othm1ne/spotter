import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeSettings } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';
import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { makeStyles, useColors } from '@/theme';

// Module constant: a new settings object on every render makes the camera reconfigure its scanner.
const SETTINGS: BarcodeSettings = { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] };

/** Wait for the sheet's slide-in to finish: a camera started mid-animation can stay black on iOS. */
const START_DELAY_MS = 450;
/** After this long without a picture, offer a retry and show what state the camera is in. */
const SLOW_START_MS = 5000;

/**
 * Inline camera viewfinder that reports each new barcode once. The camera only runs while the
 * screen is focused and `active` is true, so it shuts off when another screen opens on top.
 */
export function BarcodeScanner({ active, onScan }: { active: boolean; onScan: (code: string) => void }) {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const running = active && focused;
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ code: string; at: number } | null>(null);
  const handler = useRef(onScan);

  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  // Only the first start waits; later ones (e.g. back from the portion screen) have no animation.
  useEffect(() => {
    if (!running || !permission?.granted || mounted) return;
    const timer = setTimeout(() => setMounted(true), START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [running, permission?.granted, mounted]);

  useEffect(() => {
    if (ready || mountError || !permission?.granted) return;
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS);
    return () => clearTimeout(timer);
  }, [ready, mountError, permission?.granted, attempt]);

  // Stable callback: swapping it in and out restarts the native scanner.
  const onBarcodeScanned = useCallback(({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    // The same code is reported many times per second; take it once, allow a rescan after 3 s.
    if (last.current && last.current.code === data && now - last.current.at < 3000) return;
    last.current = { code: data, at: now };
    handler.current(data);
  }, []);

  function retry() {
    setReady(false);
    setMountError(null);
    setSlow(false);
    setAttempt((a) => a + 1);
  }

  if (!permission) return <View style={styles.box} />;

  if (!permission.granted) {
    return (
      <View style={[styles.box, styles.center]}>
        <Ionicons name="barcode-outline" size={44} color={c.accent} />
        <Text style={styles.text}>{t('scanner.allowBody')}</Text>
        {permission.canAskAgain ? (
          <Button label={t('scanner.allow')} onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        ) : (
          <Button label={t('common.openSettings')} onPress={() => Linking.openSettings()} style={{ alignSelf: 'stretch' }} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {mounted && running && (
        <CameraView
          key={attempt}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={SETTINGS}
          onBarcodeScanned={onBarcodeScanned}
          onCameraReady={() => setReady(true)}
          onMountError={(e) => setMountError(e.message)}
        />
      )}
      {!ready && !mountError && (
        <View style={styles.overlayCenter} pointerEvents="none">
          <ActivityIndicator color={c.accent} />
          <Text style={styles.text}>{t('scanner.starting')}</Text>
        </View>
      )}
      {slow && !ready && !mountError && (
        <View style={styles.overlayBottom}>
          <Button label={t('common.retry')} variant="secondary" onPress={retry} />
        </View>
      )}
      {mountError && (
        <View style={styles.overlayCenter}>
          <Ionicons name="warning" size={28} color={c.warning} />
          <Text style={styles.text}>{t('scanner.failed', { error: mountError })}</Text>
          <Button label={t('common.retry')} variant="secondary" onPress={retry} />
        </View>
      )}
      {ready && <View style={styles.frame} pointerEvents="none" />}
      {/* Rounded corners are drawn on top instead of clipping: clipping the native camera
          preview layer can turn it black on iOS. */}
      <View style={styles.corners} pointerEvents="none" />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    height: 260,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { gap: Spacing.md, padding: Spacing.lg, backgroundColor: c.surface, borderRadius: Radius.lg },
  overlayCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg },
  overlayBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.sm, padding: Spacing.md },
  text: { color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  frame: {
    width: '72%',
    height: 120,
    borderRadius: Radius.md,
    borderWidth: 3,
    borderColor: c.accent,
  },
  corners: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: Radius.lg + 6,
    borderWidth: 6,
    borderColor: c.background,
    margin: -6,
  },
}));
