import type en from './locales/en/translation.json';

type DeepKeyOf<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : {
      [K in keyof T]: K extends string
        ? Prefix extends ''
          ? DeepKeyOf<T[K], K>
          : DeepKeyOf<T[K], `${Prefix}.${K}`>
        : never;
    }[keyof T];

export type TranslationKey = DeepKeyOf<typeof en>;

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
    returnNull: false;
    returnEmptyString: false;
  }
}
