export type Lang = "en" | "ml";
const dict = {
  title: { en: "Kerala Prayer Times", ml: "കേരള നമസ്കാര സമയം" },
  district: { en: "District", ml: "ജില്ല" },
  search: { en: "Search district…", ml: "ജില്ല തിരയുക…" },
  locate: { en: "Use my location", ml: "എന്റെ സ്ഥാനം" },
  next: { en: "Next Prayer", ml: "അടുത്ത നമസ്കാരം" },
  remaining: { en: "Remaining", ml: "ബാക്കി സമയം" },
  tomorrow: { en: "tomorrow", ml: "നാളെ" },
  todays: { en: "Today's Prayer Times", ml: "ഇന്നത്തെ നമസ്കാര സമയങ്ങൾ" },
  notPrayer: { en: "Not a prayer — no Azan", ml: "നമസ്കാരമല്ല — ബാങ്ക് ഇല്ല" },
  upcoming: { en: "Upcoming", ml: "അടുത്തത്" },
  azan: { en: "Azan Player", ml: "ബാങ്ക് പ്ലെയർ" },
  stopwatch: { en: "Stopwatch", ml: "സ്റ്റോപ്പ് വാച്ച്" },
  settings: { en: "Settings", ml: "ക്രമീകരണങ്ങൾ" },
  updated: { en: "Last updated", ml: "അവസാനം പുതുക്കിയത്" },
  cached: { en: "saved copy", ml: "സംരക്ഷിച്ച പകർപ്പ്" },
  retry: { en: "Retry", ml: "വീണ്ടും" },
  digital: { en: "Digital", ml: "ഡിജിറ്റൽ" },
  analog: { en: "Analog", ml: "അനലോഗ്" },
} as const;
export type Key = keyof typeof dict;
export const tr = (lang: Lang) => (k: Key) => dict[k][lang];
