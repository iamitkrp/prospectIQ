import { describe, it, expect } from 'vitest';
import { buildUserPrompt, getSystemPrompt } from './prompts';

describe('Prompts Library', () => {
    it('should return the correct system prompt', () => {
        const systemPrompt = getSystemPrompt();
        expect(systemPrompt).toContain('You are an elite cold outreach copywriter.');
        expect(systemPrompt).toContain('RESPOND IN VALID JSON');
    });

    it('should build a user prompt correctly with basic variables', () => {
        const vars = {
            first_name: 'John',
            company_name: 'Acme Corp',
            role: 'Engineering Manager',
        };

        const result = buildUserPrompt(vars);

        // Assertions for basic properties that the prompt context builder might include
        expect(result).toContain('Write a cold outreach email for this prospect');
        expect(result).toContain('John');
        expect(result).toContain('Acme Corp');
        expect(result).toContain('Engineering Manager');
    });

    it('should include sender info and tone when provided', () => {
        const vars = {
            first_name: 'Jane',
            sender_name: 'Amit',
            sender_company: 'ProspectIQ',
            tone: 'bold' as const
        };

        const result = buildUserPrompt(vars);

        expect(result).toContain('Jane');
        expect(result).toContain('## Sender');
        expect(result).toContain('Amit');
        expect(result).toContain('ProspectIQ');
        expect(result).toContain('## Tone: bold');
    });
});
