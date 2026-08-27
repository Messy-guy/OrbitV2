import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MobileProjectSummary } from '../../types/orbit';
import { OrbitTokens } from '../../design-system/tokens';
import { GlassCard } from '../../design-system/primitives/GlassCard';
import { AstryxBadge } from '../../design-system/primitives/AstryxBadge';
import { FolderGit2, GitBranch, LayoutGrid, Users, ChevronRight } from 'lucide-react-native';

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
          <FolderGit2 size={20} color={isActive ? '#FB923C' : '#94A3B8'} />
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
              label={`${project.activeAgentsCount} Running`}
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

      {/* Path preview */}
      <Text style={styles.pathText} numberOfLines={1}>
        {project.projectPath}
      </Text>

      {/* Real Desktop Telemetry Chips Row */}
      <View style={styles.telemetryRow}>
        {/* Spawned Agents */}
        <View style={styles.telemetryChip}>
          <Users size={12} color={project.totalAgentsCount > 0 ? '#FB923C' : '#8C827A'} />
          <Text style={styles.telemetryText}>
            <Text style={styles.telemetryHighlight}>{project.totalAgentsCount ?? project.activeAgentsCount ?? 0}</Text> Agents
          </Text>
        </View>

        <View style={styles.chipDivider} />

        {/* Canvas Spaces */}
        <View style={styles.telemetryChip}>
          <LayoutGrid size={12} color="#FDBA74" />
          <Text style={styles.telemetryText}>
            <Text style={styles.telemetryHighlight}>{project.spacesCount || project.spaces?.length || 1}</Text> Spaces
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.arrowRow}>
          <Text style={styles.viewDetailsText}>Inspect</Text>
          <ChevronRight size={13} color="#FB923C" />
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 146, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF7ED',
    letterSpacing: -0.2,
  },
  branchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  branchText: {
    fontSize: 11.5,
    color: '#D6C7B8',
    fontFamily: 'monospace',
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pathText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#8C827A',
    marginTop: 10,
    marginBottom: 4,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  telemetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  telemetryText: {
    fontSize: 11.5,
    color: '#D6C7B8',
    fontFamily: 'monospace',
  },
  telemetryHighlight: {
    color: '#FFF7ED',
    fontWeight: '700',
  },
  chipDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  arrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FB923C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
