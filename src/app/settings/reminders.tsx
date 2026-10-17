import { ScrollView } from 'react-native';

import { ReminderSettingsSection } from '@/components/reminder-settings';
import { Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';

/** Meal, water, weigh-in and workout reminders. */
export default function RemindersSettingsScreen() {
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ReminderSettingsSection />
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: Spacing.lg, paddingBottom: 60 },
}));
