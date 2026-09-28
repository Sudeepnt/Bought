export const CAPTION_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zh', label: 'Mandarin Chinese', nativeLabel: '中文' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
] as const;

export type CaptionLanguageCode = (typeof CAPTION_LANGUAGES)[number]['code'];

export function captionLanguageBaseCode(language: string | undefined) {
  return language?.trim().toLowerCase().split('-')[0] ?? '';
}
