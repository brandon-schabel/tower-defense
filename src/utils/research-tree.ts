
export enum ResearchCategory {
    Tower = 'tower',
    Player = 'player',
    Economy = 'economy',
    Utility = 'utility'
}

export interface ResearchNode {
    id: string;
    name: string;
    description: string;
    category: ResearchCategory;
    cost: number;
    level: number;
    maxLevel: number;
    requiredResearch: string[];
    effects: any;
}

export class ResearchTree {
    private static instance: ResearchTree;
    private researchNodes: Map<string, ResearchNode> = new Map();
    private completedResearch: Map<string, number> = new Map(); // Research ID -> Level
    
    private constructor() {
        this.initializeResearchTree();
    }
    
    public static getInstance(): ResearchTree {
        if (!ResearchTree.instance) {
            ResearchTree.instance = new ResearchTree();
        }
        return ResearchTree.instance;
    }
    
    private initializeResearchTree() {
        // Tower research
        this.addResearchNode({
            id: 'tower_damage',
            name: 'Advanced Weaponry',
            description: 'Increase the damage of all towers by 10% per level',
            category: ResearchCategory.Tower,
            cost: 500,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { towerDamageMultiplier: 0.1 }
        });
        
        this.addResearchNode({
            id: 'tower_range',
            name: 'Enhanced Optics',
            description: 'Increase the range of all towers by 10% per level',
            category: ResearchCategory.Tower,
            cost: 500,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { towerRangeMultiplier: 0.1 }
        });
        
        this.addResearchNode({
            id: 'tower_speed',
            name: 'Rapid Fire Systems',
            description: 'Increase the attack speed of all towers by 10% per level',
            category: ResearchCategory.Tower,
            cost: 500,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { towerSpeedMultiplier: 0.1 }
        });
        
        this.addResearchNode({
            id: 'tower_aoe',
            name: 'Splash Damage',
            description: 'Towers have a 10% chance per level to deal splash damage',
            category: ResearchCategory.Tower,
            cost: 1000,
            level: 1,
            maxLevel: 3,
            requiredResearch: ['tower_damage'],
            effects: { towerSplashChance: 0.1 }
        });
        
        // Player research
        this.addResearchNode({
            id: 'player_health',
            name: 'Health Boost',
            description: 'Increase maximum player health by 15% per level',
            category: ResearchCategory.Player,
            cost: 400,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { playerHealthMultiplier: 0.15 }
        });
        
        this.addResearchNode({
            id: 'player_damage',
            name: 'Combat Training',
            description: 'Increase player damage by 20% per level',
            category: ResearchCategory.Player,
            cost: 400,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { playerDamageMultiplier: 0.2 }
        });
        
        // Economy research
        this.addResearchNode({
            id: 'economy_resources',
            name: 'Resource Optimization',
            description: 'Increase resources gained by 15% per level',
            category: ResearchCategory.Economy,
            cost: 600,
            level: 1,
            maxLevel: 5,
            requiredResearch: [],
            effects: { resourceGainMultiplier: 0.15 }
        });
        
        // Add more research nodes...
    }
    
    private addResearchNode(node: ResearchNode) {
        this.researchNodes.set(node.id, node);
    }
    
    public getResearchNode(id: string): ResearchNode | undefined {
        return this.researchNodes.get(id);
    }
    
    public getAllResearchNodes(): ResearchNode[] {
        return Array.from(this.researchNodes.values());
    }
    
    public getCategoryNodes(category: ResearchCategory): ResearchNode[] {
        return this.getAllResearchNodes().filter(node => node.category === category);
    }
    
    public getAvailableResearch(): ResearchNode[] {
        return this.getAllResearchNodes().filter(node => {
            // Check if research is already at max level
            const currentLevel = this.completedResearch.get(node.id) || 0;
            if (currentLevel >= node.maxLevel) {
                return false;
            }
            
            // Check if all required research is completed
            return node.requiredResearch.every(reqId => {
                const reqNode = this.researchNodes.get(reqId);
                if (!reqNode) return false;
                
                const reqLevel = this.completedResearch.get(reqId) || 0;
                return reqLevel >= reqNode.level;
            });
        });
    }
    
    public canResearch(id: string): boolean {
        const node = this.researchNodes.get(id);
        if (!node) return false;
        
        // Check if research is already at max level
        const currentLevel = this.completedResearch.get(id) || 0;
        if (currentLevel >= node.maxLevel) {
            return false;
        }
        
        // Check if all required research is completed
        return node.requiredResearch.every(reqId => {
            const reqNode = this.researchNodes.get(reqId);
            if (!reqNode) return false;
            
            const reqLevel = this.completedResearch.get(reqId) || 0;
            return reqLevel >= reqNode.level;
        });
    }
    
    public completeResearch(id: string): boolean {
        if (!this.canResearch(id)) {
            return false;
        }
        
        const currentLevel = this.completedResearch.get(id) || 0;
        this.completedResearch.set(id, currentLevel + 1);
        
        return true;
    }
    
    public getResearchLevel(id: string): number {
        return this.completedResearch.get(id) || 0;
    }
    
    public getResearchEffects(): any {
        const effects: any = {};
        
        // Accumulate effects from all completed research
        this.completedResearch.forEach((level, id) => {
            const node = this.researchNodes.get(id);
            if (!node) return;
            
            // Apply the effect based on the research level
            Object.entries(node.effects).forEach(([key, value]) => {
                if (!effects[key]) {
                    effects[key] = 0;
                }
                
                effects[key] += (value as number) * level;
            });
        });
        
        return effects;
    }
    
    public saveToStorage() {
        const data = Array.from(this.completedResearch.entries());
        localStorage.setItem('research-tree', JSON.stringify(data));
    }
    
    public loadFromStorage() {
        const data = localStorage.getItem('research-tree');
        if (data) {
            this.completedResearch = new Map(JSON.parse(data));
        }
    }
    
    public reset() {
        this.completedResearch.clear();
    }
}