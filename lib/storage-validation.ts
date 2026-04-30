/**
 * Zod Storage Validation Schemas
 *
 * Provides runtime validation for localStorage data
 * Ported from NossoFlow with improvements
 */

import { z } from 'zod';
import { CampaignStatus, ContactStatus, MessageStatus } from '../types';
import { logger } from './logger';

// ============================================================================
// Base Schemas
// ============================================================================

export const CampaignStatusSchema = z.nativeEnum(CampaignStatus);
export const ContactStatusSchema = z.nativeEnum(ContactStatus);
export const MessageStatusSchema = z.nativeEnum(MessageStatus);

export const TemplateCategorySchema = z.enum(['MARKETING', 'UTILIDADE', 'AUTENTICACAO']);
export const TemplateStatusSchema = z.enum(['APPROVED', 'PENDING', 'REJECTED']);

// ============================================================================
// Entity Schemas
// ============================================================================

export const TemplateButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string(),
  url: z.string().optional(),
  phone_number: z.string().optional(),
});

export const TemplateComponentSchema = z.object({
  type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
  format: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
  text: z.string().optional(),
  buttons: z.array(TemplateButtonSchema).optional(),
  example: z.unknown().optional(),
});

export const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: TemplateCategorySchema,
  language: z.string(),
  status: TemplateStatusSchema,
  content: z.string(),
  preview: z.string(),
  lastUpdated: z.string(),
  components: z.array(TemplateComponentSchema).optional(),
});

export const CampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: CampaignStatusSchema,
  recipients: z.number().min(0),
  delivered: z.number().min(0),
  read: z.number().min(0),
  createdAt: z.string(),
  templateName: z.string(),
});

export const ContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().min(1),
  status: ContactStatusSchema,
  tags: z.array(z.string()),
  lastActive: z.string(),
});

export const MessageSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  contactName: z.string(),
  contactPhone: z.string(),
  status: MessageStatusSchema,
  sentAt: z.string(),
  error: z.string().optional(),
});

export const AppSettingsSchema = z.object({
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  accessToken: z.string(),
  isConnected: z.boolean(),
  displayPhoneNumber: z.string().optional(),
  qualityRating: z.string().optional(),
  verifiedName: z.string().optional(),
});

// ============================================================================
// Collection Schemas
// ============================================================================

export const CampaignsArraySchema = z.array(CampaignSchema);
export const ContactsArraySchema = z.array(ContactSchema);
export const TemplatesArraySchema = z.array(TemplateSchema);
export const MessagesArraySchema = z.array(MessageSchema);

// ============================================================================
// Validation Functions
// ============================================================================

export interface ZodValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: z.ZodError;
}

/**
 * Validates data against a Zod schema
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ZodValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  logger.warn('Validation failed', {
    errors: result.error.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });

  return {
    success: false,
    errors: result.error,
  };
}

/**
 * Validates and returns data, or returns default on failure
 */
export function validateOrDefault<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  defaultValue: T
): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  logger.warn('Validation failed, using default', {
    errors: result.error.issues.slice(0, 3).map(i => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });

  return defaultValue;
}

/**
 * Validates campaigns array
 */
export function validateCampaigns(data: unknown): Campaign[] {
  return validateOrDefault(CampaignsArraySchema, data, []);
}

/**
 * Validates contacts array
 */
export function validateContacts(data: unknown): Contact[] {
  return validateOrDefault(ContactsArraySchema, data, []);
}

/**
 * Validates templates array
 */
export function validateTemplates(data: unknown): Template[] {
  return validateOrDefault(TemplatesArraySchema, data, []);
}

/**
 * Validates app settings
 */
export function validateSettings(data: unknown): AppSettings {
  return validateOrDefault(AppSettingsSchema, data, {
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    isConnected: false,
  });
}

// ============================================================================
// Type Exports (inferred from schemas)
// ============================================================================

export type Campaign = z.infer<typeof CampaignSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type TemplateComponent = z.infer<typeof TemplateComponentSchema>;
export type TemplateButton = z.infer<typeof TemplateButtonSchema>;

// ============================================================================
// Storage Helpers with Validation
// ============================================================================

/**
 * Safely parse JSON from localStorage with validation
 */
export function safeParseFromStorage<T>(
  key: string,
  schema: z.ZodSchema<T>,
  defaultValue: T
): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;

    const parsed = JSON.parse(stored);
    return validateOrDefault(schema, parsed, defaultValue);
  } catch (error) {
    logger.error('Storage parse error', {
      key,
      error: (error as Error).message,
    });
    return defaultValue;
  }
}

/**
 * Safely save to localStorage with validation
 */
export function safeSaveToStorage<T>(
  key: string,
  schema: z.ZodSchema<T>,
  data: T
): boolean {
  if (typeof window === 'undefined') return false;

  // Validate before saving
  const validation = schema.safeParse(data);
  if (!validation.success) {
    logger.error('Validation failed before save', {
      key,
      errors: validation.error.issues.slice(0, 3),
    });
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error('Storage save error', {
      key,
      error: (error as Error).message,
    });
    return false;
  }
}

// ============================================================================
// Migration Helpers
// ============================================================================

/**
 * Migrate and validate old storage data to new schema
 * Returns cleaned data with invalid entries removed
 */
export function migrateAndValidate<T>(
  data: unknown[],
  schema: z.ZodSchema<T>
): T[] {
  if (!Array.isArray(data)) return [];

  const valid: T[] = [];
  const invalid: number[] = [];

  data.forEach((item, index) => {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push(index);
    }
  });

  if (invalid.length > 0) {
    logger.warn('Migration: removed invalid entries', {
      invalidCount: invalid.length,
      totalCount: data.length,
      invalidIndices: invalid.slice(0, 10),
    });
  }

  return valid;
}
