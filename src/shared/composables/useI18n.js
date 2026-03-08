export function useI18n() {
  const t = (key, ...substitutions) =>
    browser.i18n.getMessage(key, substitutions)
  return { t }
}
