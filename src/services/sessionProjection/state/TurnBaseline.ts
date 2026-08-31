/**
 * TurnBaseline records the state of the virtual terminal screen
 * immediately prior to agent response execution for a specific user turn.
 */
export interface TurnBaseline {
  turnId: string;
  userMessageId?: string;
  userPrompt: string;
  createdAt: number;
  screenVersion: number;
  screenGeneration: number;
  baselineOccurrences: Map<string, number>;
  baselineLines: string[];
}
