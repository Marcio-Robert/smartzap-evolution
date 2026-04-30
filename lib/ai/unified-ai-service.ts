/**
 * Unified AI Service
 * 
 * Central service for all AI operations across the application.
 * Supports Google (Gemini), OpenAI (GPT), and Anthropic (Claude).
 * 
 * Built with Vercel AI SDK 6 Beta.
 * 
 * Usage:
 *   import { ai } from '@/lib/ai';
 *   const result = await ai.generateText({ prompt: 'Hello' });
 */

import { generateText as vercelGenerateText, streamText as vercelStreamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

import { supabase } from '@/lib/supabase';
import { type AIProvider, getDefaultModel } from './providers';

// =============================================================================
// TYPES
// =============================================================================

export interface AISettings {
    provider: AIProvider;
    model: string;
    apiKey: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface GenerateTextOptions {
    /** Simple text prompt (mutually exclusive with messages) */
    prompt?: string;
    /** Conversation messages (mutually exclusive with prompt) */
    messages?: ChatMessage[];
    /** System instruction */
    system?: string;
    /** Override the configured provider */
    provider?: AIProvider;
    /** Override the configured model */
    model?: string;
    /** Max output tokens */
    maxOutputTokens?: number;
    /** Temperature (0-2) */
    temperature?: number;
}

export interface StreamTextOptions extends GenerateTextOptions {
    /** Callback for each text chunk */
    onChunk?: (chunk: string) => void;
    /** Callback when complete */
    onComplete?: (text: string) => void;
}

export interface GenerateTextResult {
    text: string;
    provider: AIProvider;
    model: string;
}

// =============================================================================
// SETTINGS CACHE
// =============================================================================

let settingsCache: AISettings | null = null;
let settingsCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

async function getAISettings(): Promise<AISettings> {
    const now = Date.now();

    // Return cached if valid
    if (settingsCache && now - settingsCacheTime < CACHE_TTL) {
        return settingsCache;
    }

    // Default settings
    const defaultSettings: AISettings = {
        provider: 'google',
        model: 'gemini-2.5-flash',
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '',
    };

    try {
        // Try to load from DB
        const { data: settings } = await supabase.admin
            ?.from('settings')
            .select('key, value')
            .in('key', [
                'ai_provider',
                'ai_model',
                'gemini_api_key',
                'openai_api_key',
                'anthropic_api_key'
            ]) || { data: null };

        if (settings && settings.length > 0) {
            const settingsMap = new Map(settings.map(s => [s.key, s.value as string]));

            const provider = (settingsMap.get('ai_provider') as AIProvider) || defaultSettings.provider;
            const model = settingsMap.get('ai_model') || getDefaultModel(provider)?.id || '';

            // Get the right API key for the provider
            let apiKey = '';
            switch (provider) {
                case 'google':
                    apiKey = settingsMap.get('gemini_api_key') || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
                    break;
                case 'openai':
                    apiKey = settingsMap.get('openai_api_key') || process.env.OPENAI_API_KEY || '';
                    break;
                case 'anthropic':
                    apiKey = settingsMap.get('anthropic_api_key') || process.env.ANTHROPIC_API_KEY || '';
                    break;
            }

            settingsCache = { provider, model, apiKey };
        } else {
            settingsCache = defaultSettings;
        }
    } catch (error) {
        console.warn('[AI Service] Failed to load settings from DB, using defaults:', error);
        settingsCache = defaultSettings;
    }

    settingsCacheTime = now;
    return settingsCache;
}

/** Clear settings cache (call when settings are updated) */
export function clearSettingsCache() {
    settingsCache = null;
    settingsCacheTime = 0;
}

// =============================================================================
// PROVIDER FACTORY - AI SDK v6 uses direct provider functions
// =============================================================================

function getLanguageModel(providerId: AIProvider, modelId: string, apiKey: string) {
    if (!apiKey) {
        throw new Error(`API key not configured for provider: ${providerId}`);
    }

    switch (providerId) {
        case 'google': {
            const google = createGoogleGenerativeAI({ apiKey });
            return google(modelId);
        }
        case 'openai': {
            const openai = createOpenAI({ apiKey });
            return openai(modelId);
        }
        case 'anthropic': {
            const anthropic = createAnthropic({ apiKey });
            return anthropic(modelId);
        }
        default:
            throw new Error(`Unknown provider: ${providerId}`);
    }
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Generate text using the configured AI provider
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const settings = await getAISettings();

    const providerId = options.provider || settings.provider;
    const modelId = options.model || settings.model;

    const model = getLanguageModel(providerId, modelId, settings.apiKey);

    console.log(`[AI Service] Generating with ${providerId}/${modelId}`);

    // Build call options based on prompt vs messages
    const baseOptions = {
        model,
        system: options.system,
        temperature: options.temperature ?? 0.7,
        ...(options.maxOutputTokens && { maxOutputTokens: options.maxOutputTokens }),
    };

    const result = options.messages
        ? await vercelGenerateText({ ...baseOptions, messages: options.messages })
        : await vercelGenerateText({ ...baseOptions, prompt: options.prompt || '' });

    return {
        text: result.text,
        provider: providerId,
        model: modelId,
    };
}

/**
 * Stream text using the configured AI provider
 */
export async function streamText(options: StreamTextOptions): Promise<GenerateTextResult> {
    const settings = await getAISettings();

    const providerId = options.provider || settings.provider;
    const modelId = options.model || settings.model;

    const model = getLanguageModel(providerId, modelId, settings.apiKey);

    console.log(`[AI Service] Streaming with ${providerId}/${modelId}`);

    // Build call options based on prompt vs messages
    const baseOptions = {
        model,
        system: options.system,
        temperature: options.temperature ?? 0.7,
        ...(options.maxOutputTokens && { maxOutputTokens: options.maxOutputTokens }),
    };

    const result = options.messages
        ? vercelStreamText({ ...baseOptions, messages: options.messages })
        : vercelStreamText({ ...baseOptions, prompt: options.prompt || '' });

    // Collect full text
    let fullText = '';
    for await (const part of result.textStream) {
        fullText += part;
        options.onChunk?.(part);
    }

    options.onComplete?.(fullText);

    return {
        text: fullText,
        provider: providerId,
        model: modelId,
    };
}

/**
 * Generate text with JSON response
 */
export async function generateJSON<T = unknown>(options: GenerateTextOptions): Promise<T> {
    const result = await generateText({
        ...options,
        system: (options.system || '') + '\n\nRespond with valid JSON only, no markdown.',
    });

    try {
        // Clean markdown code blocks if present
        const cleanText = result.text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

        return JSON.parse(cleanText) as T;
    } catch {
        console.error('[AI Service] Failed to parse JSON response:', result.text);
        throw new Error('AI response was not valid JSON');
    }
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const ai = {
    generateText,
    streamText,
    generateJSON,
    clearSettingsCache,
    getSettings: getAISettings,
};

export default ai;

// Re-export types and providers
export { AI_PROVIDERS, getProvider, getModel, getDefaultModel } from './providers';
export type { AIProvider, AIModel, AIProviderConfig } from './providers';
