import { Text, View, type TextStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { makeStyles } from '@/theme';

/** Renders **bold** and *italic* spans inside one line. */
function Inline({ text, style }: { text: string; style?: TextStyle }) {
  const styles = useStyles();
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter(Boolean);
  return (
    <Text style={[styles.text, style]}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <Text key={i} style={styles.italic}>
            {part.slice(1, -1)}
          </Text>
        ) : (
          part
        )
      )}
    </Text>
  );
}

/**
 * Small Markdown subset for coach answers: paragraphs, #-headings, "-"/"*" bullets,
 * numbered lists, bold and italic. Anything else shows as plain text.
 */
export function RichText({ text }: { text: string }) {
  const styles = useStyles();
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={styles.wrap}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={styles.gap} />;
        // Tables can't be laid out on a phone: drop separator rows, show other rows as list items.
        if (/^\s*\|?\s*:?-{3,}/.test(line)) return null;
        if (line.trim().startsWith('|')) {
          const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
          return (
            <View key={i} style={styles.listRow}>
              <Text style={styles.marker}>•</Text>
              <Inline text={cells.join(' · ')} style={styles.listText} />
            </View>
          );
        }
        const heading = line.match(/^#{1,4}\s+(.*)/);
        if (heading) return <Inline key={i} text={heading[1]} style={styles.heading} />;
        const bullet = line.match(/^\s*[-*•]\s+(.*)/);
        if (bullet) {
          return (
            <View key={i} style={styles.listRow}>
              <Text style={styles.marker}>•</Text>
              <Inline text={bullet[1]} style={styles.listText} />
            </View>
          );
        }
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
        if (numbered) {
          return (
            <View key={i} style={styles.listRow}>
              <Text style={styles.marker}>{numbered[1]}.</Text>
              <Inline text={numbered[2]} style={styles.listText} />
            </View>
          );
        }
        return <Inline key={i} text={line.replace(/^>\s?/, '')} />;
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 3 },
  gap: { height: Spacing.xs },
  text: { color: c.text, fontSize: 16, lineHeight: 23 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  heading: { fontSize: 17, fontWeight: '800', marginTop: Spacing.xs },
  listRow: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: 2 },
  marker: { color: c.accent, fontSize: 16, lineHeight: 23, fontWeight: '800', minWidth: 14 },
  listText: { flex: 1 },
}));
