export interface ResearchNode {
    id: string;
    name: string;
    description: string;
    cost: number;
    tier: number;
    category: string;
    requirements: string[];
    effects?: { type: string; value: number }[]; // Optional effects
    texture: string;
    unlocked: boolean;
  } 