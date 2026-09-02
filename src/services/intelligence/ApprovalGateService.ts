import { ApprovalGate, ApprovalStatus } from '../../types/intelligence';

/**
 * Human-in-the-Loop Operation Approval Gates (§17)
 *
 * Requirements:
 * - One-time, auditable, expirable authorization
 * - Strictly project-scoped
 * - Mobile authorizes, Desktop executes
 */
export class ApprovalGateService {
  private gates: Map<string, ApprovalGate> = new Map();

  createGate(params: {
    projectId: string;
    agentId: string;
    sessionId: string;
    operationType: ApprovalGate['operationType'];
    title: string;
    description: string;
    operationPayload: Record<string, any>;
    timeoutMinutes?: number;
  }): ApprovalGate {
    const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const timeoutMs = (params.timeoutMinutes || 15) * 60 * 1000;

    // Deterministic payload hash
    const operationHash = `hash_${params.projectId}_${params.operationType}_${JSON.stringify(params.operationPayload).length}`;

    const gate: ApprovalGate = {
      id,
      operationId,
      projectId: params.projectId,
      agentId: params.agentId,
      sessionId: params.sessionId,
      operationType: params.operationType,
      title: params.title,
      description: params.description,
      operationPayload: params.operationPayload,
      operationHash,
      status: 'pending',
      expiresAt: now + timeoutMs,
      createdAt: now,
    };

    this.gates.set(id, gate);
    console.log(
      `[ApprovalGateService] Created approval gate id=${id} opType=${params.operationType} for project=${params.projectId}`
    );
    return gate;
  }

  decide(gateId: string, decision: 'approved' | 'rejected', decidedBy = 'human_user'): ApprovalGate {
    const gate = this.gates.get(gateId);
    if (!gate) {
      throw new Error(`Approval gate ${gateId} not found`);
    }

    if (gate.status !== 'pending') {
      throw new Error(`Approval gate ${gateId} already consumed with status: ${gate.status}`);
    }

    if (Date.now() > gate.expiresAt) {
      gate.status = 'expired';
      throw new Error(`Approval gate ${gateId} has expired`);
    }

    gate.status = decision;
    gate.decidedAt = Date.now();
    gate.decidedBy = decidedBy;

    console.log(
      `[ApprovalGateService] Gate ${gateId} resolved as ${decision} by ${decidedBy}`
    );
    return gate;
  }

  getPendingGatesForProject(projectId: string): ApprovalGate[] {
    const now = Date.now();
    return Array.from(this.gates.values()).filter(
      (g) => g.projectId === projectId && g.status === 'pending' && g.expiresAt > now
    );
  }
}

export const approvalGateService = new ApprovalGateService();
