import { MARKETING_PROMPT } from './marketing';
import { UTILITY_PROMPT } from './utility';
import { BYPASS_PROMPT } from './bypass';

export type AIStrategy = 'marketing' | 'utility' | 'bypass';

export class PromptFactory {
    static getSystemPrompt(strategy: AIStrategy): string {
        switch (strategy) {
            case 'marketing':
                return MARKETING_PROMPT;
            case 'utility':
                return UTILITY_PROMPT;
            case 'bypass':
            default:
                return BYPASS_PROMPT;
        }
    }

    static getCategoryHint(strategy: AIStrategy): string {
        if (strategy === 'marketing') return 'MARKETING';
        return 'UTILITY';
    }
}
