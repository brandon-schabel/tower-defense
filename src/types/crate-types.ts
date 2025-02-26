export enum CrateType {
    Wood = 'wood',
    Metal = 'metal',
    Gold = 'gold'
}

export interface CrateContents {
    resources?: number;
    items?: any[]; // Assuming items are GameItem or similar, refine type if known
}