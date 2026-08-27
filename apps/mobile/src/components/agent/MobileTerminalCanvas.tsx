import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';

interface TerminalEntry {
  text: string;
  type: string;
}

interface MobileTerminalCanvasProps {
  logs: (string | TerminalEntry)[];
  fontSize?: number;
  onData?: (data: string) => void;
}

/** Normalize a log entry into { text, type } */
function normalize(entry: string | TerminalEntry): TerminalEntry {
  if (typeof entry === 'string') {
    return { text: entry, type: 'stdout' };
  }
  return entry;
}

/** Strip any remaining ANSI fragments that survived desktop cleaning */
function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\[\?[0-9]+[hl]/g, '')
    .replace(/\x1b[()][A-Z0-9]/g, '')
    .replace(/\x1b[\x20-\x2F]*[\x40-\x7E]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/\[\?[0-9]+[hl]/g, '')
    .replace(/\r/g, '')
    .trim();
}

export const MobileTerminalCanvas: React.FC<MobileTerminalCanvasProps> = ({
  logs,
  fontSize = 12,
}) => {
  const scrollRef = useRef<ScrollView>(null);

  const lines = useMemo(() => {
    const result: { key: string; text: string; type: string }[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < logs.length; i++) {
      const entry = normalize(logs[i]);
      const cleaned = stripAnsi(entry.text);
      if (!cleaned) continue;

      // Skip TUI chrome lines (pure box drawing / spinner blocks)
      if (/^[─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬□■⬝▣\s|·•]+$/.test(cleaned)) continue;

      // Deduplicate
      const fp = cleaned.slice(0, 100);
      if (seen.has(fp)) continue;
      seen.add(fp);
      if (seen.size > 200) { const it = seen.values(); seen.delete(it.next().value!); }

      result.push({ key: `l-${i}`, text: cleaned, type: entry.type });
    }

    return result;
  }, [logs]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [lines.length]);

  const getLineStyle = (type: string, text: string) => {
    // Style based on line type metadata
    if (type === 'stdin') return styles.userLine;
    if (type === 'stderr') return styles.errorLine;
    if (type === 'system') return styles.systemLine;
    if (type === 'tool') return styles.toolLine;
    if (type === 'diff-add') return styles.diffAddLine;
    if (type === 'diff-del') return styles.diffDelLine;

    // Content-based heuristic hints for stdout lines
    const lower = text.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('失败')) return styles.errorLine;
    if (lower.includes('plan') || lower.includes('thinking')) return styles.planLine;
    if (text.startsWith('>') || text.startsWith('$') || text.startsWith('❯')) return styles.userLine;

    return styles.stdoutLine;
  };

  const getLinePrefix = (type: string) => {
    if (type === 'stdin') return '❯ ';
    if (type === 'stderr') return '';
    if (type === 'system') return '⚙ ';
    if (type === 'tool') return '🔧 ';
    if (type === 'diff-add') return '+ ';
    if (type === 'diff-del') return '- ';
    return '';
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        indicatorStyle="white"
      >
        {lines.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>●</Text>
            <Text style={styles.emptyText}>Session connected. Awaiting output...</Text>
          </View>
        ) : (
          lines.map((line) => {
            const prefix = getLinePrefix(line.type);
            const isUser = line.type === 'stdin';

            return (
              <View
                key={line.key}
                style={[
                  styles.lineContainer,
                  isUser && styles.userLineContainer,
                ]}
              >
                {line.type === 'stdin' && <View style={styles.userAccent} />}
                <Text
                  style={[
                    styles.lineText,
                    { fontSize, lineHeight: fontSize * 1.55 },
                    getLineStyle(line.type, line.text),
                  ]}
                  selectable
                >
                  {prefix}{line.text}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  lineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userLineContainer: {
    backgroundColor: 'rgba(251, 146, 60, 0.06)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  userAccent: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: '#f97316',
    borderRadius: 1,
    marginRight: 8,
  },
  lineText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d8',
    flex: 1,
  },
  // Type-based styles
  userLine: {
    color: '#f97316',
    fontWeight: '600',
  },
  stdoutLine: {
    color: '#d4d4d8',
  },
  errorLine: {
    color: '#f87171',
  },
  systemLine: {
    color: '#71717a',
    fontStyle: 'italic',
  },
  toolLine: {
    color: '#60a5fa',
  },
  planLine: {
    color: '#c084fc',
  },
  diffAddLine: {
    color: '#4ade80',
  },
  diffDelLine: {
    color: '#f87171',
  },
  // Empty state
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyIcon: {
    color: '#27272a',
    fontSize: 28,
  },
  emptyText: {
    color: '#3f3f46',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
