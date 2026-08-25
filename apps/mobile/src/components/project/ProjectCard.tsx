import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MobileProjectSummary } from '../../types/orbit';
import { OrbitTokens } from '../../design-system/tokens';
import { GlassCard } from '../../design-system/primitives/GlassCard';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { ChevronRight, FolderGit2, GitBranch, Activity } from 'lucide-react-native';

interface Props {
  project: MobileProjectSummary;
  onPress: () => void;
}

export const ProjectCard: React.FC<Props> = ({ project, onPress }) => {
  const isActive = project.activeAgentsCount > 0;
  const hasErrors = project.failingTestsCount > 0;

  return (
    <GlassCard onPress={onPress} active={isActive}>
      {/* Top Identity & Status Row */}
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <FolderGit2 size={20} color={isActive ? '#38BDF8' : '#94A3B8'} />
        </View>

        <View style={styles.nameBlock}>
          <Text style={styles.projectName} numberOfLines={1}>
            {project.name}
          </Text>
          <View style={styles.branchBox}>
            <GitBranch size={12} color="#94A3B8" />
            <Text style={styles.branchText}>{project.gitBranch || 'main'}</Text>
          </View>
        </View>

        <View style={styles.badgeGroup}>
          {isActive && (
            <AstryxBadge
              label={`${project.activeAgentsCount} Active`}
              variant="primary"
              showDot
            />
          )}
          {hasErrors && (
            <AstryxBadge
              label={`${project.failingTestsCount} Failing`}
              variant="danger"
            />
          )}
        </View>
      </View>

      {/* Activity Digest */}
      {project.lastActivitySummary ? (
        <View style={styles.activityBox}>
          <Activity size={13} color="#38BDF8" style={{ marginTop: 2 }} />
          <Text style={styles.activityText} numberOfLines={2}>
            {project.lastActivitySummary}
          </Text>
        </View>
      ) : null}

      {/* Footer Metrics */}
      <View style={styles.footerRow}>
        <Text style={styles.metaText}>
          {project.filesModifiedCount} modified files
        </Text>
        <View style={styles.freshnessBox}>
          <Text style={[styles.metaText, { color: '#38BDF8', fontWeight: '600' }]}>
            {project.contextFreshnessPercentage}% Fresh
          </Text>
          <ChevronRight size={15} color="#94A3B8" />
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nameBlock: {
    flex: 1,
    gap: 3,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  branchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  branchText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 12,
    borderRadius: OrbitTokens.radii.sm,
    borderWidth: 1,
    borderColor: OrbitTokens.border.glassHairline,
    marginBottom: 12,
  },
  activityText: {
    fontSize: 12.5,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 10,
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  freshnessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
