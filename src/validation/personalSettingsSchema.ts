import { z } from 'zod';

// Schema para validação de telefone português
const phoneRegex = /^(\+351\s?)?[2-9]\d{8}$/;

// Schema para configurações de notificações
export const notificationSettingsSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  goal_reminders: z.boolean().default(true),
  budget_alerts: z.boolean().default(true),
  transaction_alerts: z.boolean().default(false),
});

// Schema para configurações de aparência
export const appearanceSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  compact_mode: z.boolean().default(false),
  show_currency_symbol: z.boolean().default(true),
});

// Schema para configurações pessoais completas
export const personalSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.enum(['pt-PT', 'en-US']).default('pt-PT'),
  currency: z.string().min(3).max(3).default('EUR'),
  notifications: notificationSettingsSchema,
  appearance: appearanceSettingsSchema,
});

// Schema para dados do perfil
export const profileDataSchema = z.object({
  first_name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(50, 'Nome deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras'),
  last_name: z.string()
    .min(1, 'Apelido é obrigatório')
    .max(50, 'Apelido deve ter no máximo 50 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Apelido deve conter apenas letras'),
  phone: z.string()
    .regex(phoneRegex, 'Telefone deve ser um número português válido (ex: +351 123 456 789)')
    .optional()
    .or(z.literal('')),
  birth_date: z.string()
    .refine((date) => {
      if (!date) return true; // Campo opcional
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 13 && age <= 120;
    }, 'Data de nascimento deve ser válida e o utilizador deve ter pelo menos 13 anos')
    .optional()
    .or(z.literal('')),
});

// Schema para alteração de palavra-passe
export const passwordChangeSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Palavra-passe atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'Nova palavra-passe deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Palavra-passe deve conter pelo menos uma letra maiúscula, uma minúscula e um número')
    .max(128, 'Palavra-passe deve ter no máximo 128 caracteres'),
  confirmPassword: z.string()
    .min(1, 'Confirmação de palavra-passe é obrigatória'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As palavras-passe não coincidem",
  path: ["confirmPassword"],
});

// Tipos TypeScript derivados dos schemas
export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;
export type PersonalSettings = z.infer<typeof personalSettingsSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;
export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;

// Funções de validação
export const validateProfileData = (data: unknown): ProfileData => {
  return profileDataSchema.parse(data);
};

export const validatePasswordChange = (data: unknown): PasswordChangeData => {
  return passwordChangeSchema.parse(data);
};

export const validatePersonalSettings = (data: unknown): PersonalSettings => {
  return personalSettingsSchema.parse(data);
};

// Funções de validação seguras (não lançam exceções)
export const safeValidateProfileData = (data: unknown) => {
  return profileDataSchema.safeParse(data);
};

export const safeValidatePasswordChange = (data: unknown) => {
  return passwordChangeSchema.safeParse(data);
};

export const safeValidatePersonalSettings = (data: unknown) => {
  return personalSettingsSchema.safeParse(data);
};

// Função para formatar telefone português
export const formatPhoneNumber = (phone: string): string => {
  // Remove todos os caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 351, remove
  const withoutCountry = cleaned.startsWith('351') ? cleaned.slice(3) : cleaned;
  
  // Se tiver 9 dígitos, formata
  if (withoutCountry.length === 9) {
    return `+351 ${withoutCountry.slice(0, 3)} ${withoutCountry.slice(3, 6)} ${withoutCountry.slice(6)}`;
  }
  
  return phone;
};

// Função para validar e formatar telefone
export const validateAndFormatPhone = (phone: string): string | null => {
  if (!phone) return null;

  const cleaned = phone.replace(/\D/g, '');
  const withoutCountry = cleaned.startsWith('351') ? cleaned.slice(3) : cleaned;

  if (!/^[2-9]\d{8}$/.test(withoutCountry)) {
    return null;
  }

  return formatPhoneNumber(phone);
};
