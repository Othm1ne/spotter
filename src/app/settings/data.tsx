import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView } from 'react-native';

import { Row, Section } from '@/components/settings-rows';
import { Spacing } from '@/constants/theme';
import { BackupError, deleteAllChats, deleteAllData, restoreBackup } from '@/db/backup';
import { useI18n, useT } from '@/i18n';
import { pickBackup, shareBackup } from '@/services/backup';
import { makeStyles, useColors } from '@/theme';

/** Backup, restore and deleting data. */
export default function DataSettingsScreen() {
  const t = useT();
  const c = useColors();
  const styles = useStyles();
  const db = useSQLiteContext();
  const { locale } = useI18n();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);

  async function onExport() {
    setBusy('export');
    try {
      await shareBackup(db);
    } catch {
      Alert.alert(t('settings.backupFailed'), t('settings.backupFailedBody'));
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    try {
      const backup = await pickBackup(db);
      if (!backup) return;
      Alert.alert(
        t('settings.restoreTitle'),
        t('settings.restoreBody', {
          date: new Date(backup.exportedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
          workouts: backup.tables.workouts?.length ?? 0,
          foods: backup.tables.food_entries?.length ?? 0,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.restore'),
            style: 'destructive',
            onPress: async () => {
              setBusy('restore');
              try {
                await restoreBackup(db, backup);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert(t('settings.restored'), t('settings.restoredBody'), [
                  { text: t('common.ok'), onPress: () => router.dismissAll() },
                ]);
              } catch {
                Alert.alert(t('settings.restoreFailed'), t('settings.restoreFailedBody'));
              } finally {
                setBusy(null);
              }
            },
          },
        ]
      );
    } catch (e) {
      Alert.alert(t('settings.cantRestore'), e instanceof BackupError ? t(`backup.${e.kind}`) : t('settings.unreadable'));
    }
  }

  function onDeleteChats() {
    Alert.alert(t('settings.deleteChatsTitle'), t('settings.deleteChatsBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteAllChats(db);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  }

  function onDeleteAll() {
    Alert.alert(t('settings.deleteAllTitle'), t('settings.deleteAllBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.deleteEverything'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(t('settings.sure'), t('settings.cannotUndo'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: async () => {
                await deleteAllData(db);
                router.dismissAll();
              },
            },
          ]),
      },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title={t('settings.backup')} footer={t('settings.dataFooter')}>
        <Row
          icon="share-outline"
          title={t('settings.export')}
          subtitle={t('settings.exportSub')}
          onPress={onExport}
          right={busy === 'export' ? <ActivityIndicator color={c.accent} /> : undefined}
        />
        <Row
          icon="download-outline"
          title={t('settings.restoreRow')}
          subtitle={t('settings.restoreSub')}
          onPress={onRestore}
          right={busy === 'restore' ? <ActivityIndicator color={c.accent} /> : undefined}
        />
      </Section>

      <Section title={t('settings.erase')}>
        <Row icon="chatbubbles" title={t('settings.deleteChats')} danger onPress={onDeleteChats} />
        <Row icon="trash" title={t('settings.deleteAll')} danger onPress={onDeleteAll} />
      </Section>
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 60 },
}));
