"use client";
import { createContext, useContext, type ReactNode } from "react";
import { formatters, type Language } from "./i18n";
const LocaleContext = createContext(formatters("es"));
export function LocaleProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={formatters(language)}>
      {children}
    </LocaleContext.Provider>
  );
}
export const useLocale = () => useContext(LocaleContext);
