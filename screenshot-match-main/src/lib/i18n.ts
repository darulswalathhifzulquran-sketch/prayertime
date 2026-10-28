export type Lang = "en" | "ml" | "ar";
const dict = {
  title: { en: "AWQAAT", ml: "AWQAAT", ar: "أوقات" },
  district: { en: "District", ml: "ജില്ല", ar: "المنطقة" },
  search: { en: "Search district…", ml: "ജില്ല തിരയുക…", ar: "ابحث عن المنطقة…" },
  locate: { en: "Use my location", ml: "എന്റെ സ്ഥാനം", ar: "استخدم موقعي" },
  next: { en: "Next Prayer", ml: "അടുത്ത നമസ്കാരം", ar: "الصلاة القادمة" },
  remaining: { en: "Remaining", ml: "ബാക്കി സമയം", ar: "الوقت المتبقي" },
  tomorrow: { en: "tomorrow", ml: "നാളെ", ar: "غدًا" },
  todays: { en: "Today's Prayer Times", ml: "ഇന്നത്തെ നമസ്കാര സമയങ്ങൾ", ar: "مواقيت الصلاة اليوم" },
  notPrayer: { en: "Not a prayer — no Azan", ml: "നമസ്കാരമല്ല — ബാങ്ക് ഇല്ല", ar: "ليس وقت صلاة — لا أذان" },
  upcoming: { en: "Upcoming", ml: "അടുത്തത്", ar: "القادمة" },
  azan: { en: "Azan Player", ml: "ബാങ്ക് പ്ലെയർ", ar: "مشغل الأذان" },
  stopwatch: { en: "Stopwatch", ml: "സ്റ്റോപ്പ് വാച്ച്", ar: "ساعة الإيقاف" },
  settings: { en: "Settings", ml: "ക്രമീകരണങ്ങൾ", ar: "الإعدادات" },
  updated: { en: "Last updated", ml: "അവസാനം പുതുക്കിയത്", ar: "آخر تحديث" },
  cached: { en: "saved copy", ml: "സംരക്ഷിച്ച പകർപ്പ്", ar: "نسخة محفوظة" },
  retry: { en: "Retry", ml: "വീണ്ടും", ar: "إعادة المحاولة" },
  digital: { en: "Digital", ml: "ഡിജിറ്റൽ", ar: "رقمية" },
  analog: { en: "Analog", ml: "അനലോഗ്", ar: "عقارب" },
  navHome: { en: "Home", ml: "ഹോം", ar: "الرئيسية" },
  navPrayer: { en: "Prayer", ml: "നിസ്കാരം", ar: "الصلاة" },
  navAzan: { en: "Azan", ml: "ബാങ്ക്", ar: "الأذان" },
  navReminder: { en: "Reminder", ml: "ഓർമ്മപ്പെടുത്തൽ", ar: "التنبيه" },
  navTimer: { en: "Timer", ml: "ടൈമർ", ar: "المؤقت" },
  interfaceLanguage: { en: "Interface language", ml: "ഇന്റർഫേസ് ഭാഷ", ar: "لغة الواجهة" },
  calculationMethod: { en: "Calculation method", ml: "കണക്കുകൂട്ടൽ രീതി", ar: "طريقة الحساب" },
  shafiiNote: { en: "Asr is always Shafi'i (standard shadow).", ml: "അസർ സമയം ശാഫിഈ രീതിയിലാണ് (സാധാരണ നിഴൽ).", ar: "يُحسب وقت العصر وفق المذهب الشافعي (ظل واحد)." },
  timeFormat: { en: "Time format", ml: "സമയ രൂപം", ar: "تنسيق الوقت" },
  clock: { en: "Clock", ml: "ക്ലോക്ക്", ar: "الساعة" },
  theme: { en: "Theme", ml: "തീം", ar: "المظهر" },
  light: { en: "Light", ml: "ലൈറ്റ്", ar: "فاتح" },
  dark: { en: "Dark", ml: "ഡാർക്ക്", ar: "داكن" },
  h12: { en: "12-hour", ml: "12 മണിക്കൂർ", ar: "12 ساعة" },
  h24: { en: "24-hour", ml: "24 മണിക്കൂർ", ar: "24 ساعة" },
  gpsCurrent: { en: "Current GPS location", ml: "നിലവിലെ GPS സ്ഥാനം", ar: "موقع GPS الحالي" },
  gpsYours: { en: "Your current GPS location", ml: "നിങ്ങളുടെ ഇപ്പോഴത്തെ GPS സ്ഥാനം", ar: "موقعك الحالي عبر GPS" },
  gpsEnabled: { en: "Turn off GPS location", ml: "GPS ലൊക്കേഷൻ ഓഫ് ചെയ്യുക", ar: "إيقاف تحديد الموقع" },
  gpsDisabled: { en: "Use current GPS location for prayer times", ml: "നിസ്കാര സമയത്തിന് നിലവിലെ സ്ഥാനം ഉപയോഗിക്കുക", ar: "استخدم الموقع الحالي لمواقيت الصلاة" },
  gpsActive: { en: "GPS prayer times active", ml: "GPS നിസ്കാരസമയങ്ങൾ സജീവം", ar: "مواقيت الصلاة حسب GPS مفعّلة" },
  gpsAccuracy: { en: "accuracy", ml: "കൃത്യത", ar: "دقة" },
  gpsApprox: { en: "Location is approximate; improve GPS accuracy for better results.", ml: "സ്ഥാനം ഏകദേശമാണ്; GPS കൃത്യത മെച്ചപ്പെടുത്തുക.", ar: "الموقع تقريبي؛ حسّن دقة GPS لنتائج أفضل." },
  gpsRequest: { en: "Requesting precise location permission…", ml: "കൃത്യമായ ലൊക്കേഷൻ അനുമതി അഭ്യർത്ഥിക്കുന്നു…", ar: "جارٍ طلب إذن الموقع الدقيق…" },
  apiWarning: { en: "API-calculated times — NOT verified local mosque times", ml: "API കണക്കാക്കിയ സമയം — പ്രാദേശിക പള്ളി സമയം സ്ഥിരീകരിച്ചിട്ടില്ല", ar: "أوقات محسوبة إلكترونيًا — غير مؤكدة من المسجد المحلي" },
  apiCaution: { en: "GPS identifies the location; it cannot verify the local mosque timetable. Compare with your local masjid's approved calendar before relying on prayer times or Azan reminders.", ml: "GPS സ്ഥാനം കണ്ടെത്തും; പള്ളിയിലെ സമയപ്പട്ടിക സ്ഥിരീകരിക്കില്ല. സമയങ്ങൾക്കോ ബാങ്ക് ഓർമ്മപ്പെടുത്തലുകൾക്കോ മുമ്പ് പ്രാദേശിക പള്ളിയുടെ അംഗീകൃത കലണ്ടർ പരിശോധിക്കുക.", ar: "يحدد GPS الموقع، لكنه لا يتحقق من جدول المسجد المحلي. قارن الأوقات بالتقويم المعتمد لمسجدك قبل الاعتماد عليها أو على تنبيهات الأذان." },
  azanReminders: { en: "Azan Reminders", ml: "ബാങ്ക് ഓർമ്മപ്പെടുത്തലുകൾ", ar: "تنبيهات الأذان" },
  record: { en: "Azan recording", ml: "ബാങ്കിന്റെ റെക്കോർഡിംഗ്", ar: "تسجيل الأذان" },
  noRecording: { en: "No Azan recording has been uploaded yet. Reminders will still show a notification.", ml: "ബാങ്ക് റെക്കോർഡിംഗ് ഇതുവരെ ചേർത്തിട്ടില്ല. ഓർമ്മപ്പെടുത്തൽ അറിയിപ്പ് തുടരും.", ar: "لم يُرفع تسجيل للأذان بعد. ستظهر إشعارات التنبيه مع ذلك." },
  turnOff: { en: "Turn off", ml: "ഓഫ് ചെയ്യുക", ar: "إيقاف" },
  enableAzan: { en: "Enable Azan Audio", ml: "ബാങ്ക് ശബ്ദം പ്രവർത്തിപ്പിക്കുക", ar: "تفعيل صوت الأذان" },
  enableReminder: { en: "Enable Reminders", ml: "ഓർമ്മപ്പെടുത്തലുകൾ പ്രവർത്തിപ്പിക്കുക", ar: "تفعيل التنبيهات" },
  reminderCaution: { en: "Azan notifications work only while this page is open with browser permission. Audio playback also needs a recording and browser sound permission. No reminder or Azan plays at Sunrise.", ml: "ബ്രൗസറിന്റെ അനുമതിയോടെ പേജ് തുറന്നിരിക്കുമ്പോൾ മാത്രമേ ബാങ്ക് അറിയിപ്പുകൾ പ്രവർത്തിക്കൂ. ശബ്ദത്തിന് റെക്കോർഡിംഗും ശബ്ദാനുമതിയും വേണം. ഉദയത്തിന് ബാങ്കോ ഓർമ്മപ്പെടുത്തലോ ഇല്ല.", ar: "تعمل إشعارات الأذان فقط أثناء فتح الصفحة مع إذن المتصفح. يتطلب الصوت وجود تسجيل وإذن التشغيل. لا أذان ولا تنبيه عند الشروق." },
  playError: { en: "Unable to play Azan. Check your browser sound permissions and try Play again.", ml: "ബാങ്ക് പ്ലേ ചെയ്യാനായില്ല. ബ്രൗസറിലെ ശബ്ദാനുമതി പരിശോധിക്കുക.", ar: "تعذّر تشغيل الأذان. تحقق من إذن الصوت في المتصفح وحاول مجددًا." },
  loadError: { en: "Azan recording could not be loaded. Please refresh and try again.", ml: "ബാങ്ക് റെക്കോർഡിംഗ് ലോഡായില്ല. പേജ് പുതുക്കി ശ്രമിക്കുക.", ar: "تعذّر تحميل تسجيل الأذان. حدّث الصفحة وحاول مجددًا." },
  source: { en: "Source", ml: "ഉറവിടം", ar: "المصدر" },
  method: { en: "Method", ml: "രീതി", ar: "الطريقة" },
  timezone: { en: "Timezone", ml: "സമയമേഖല", ar: "المنطقة الزمنية" },
  footerGps: { en: "Prayer times are calculated using your browser's GPS coordinates (shared with AlAdhan when requesting timings). GPS has an uncertainty radius and is not guaranteed to be exact. Coordinates are not saved in browser storage.", ml: "നിസ്കാരസമയങ്ങൾ ബ്രൗസറിലെ GPS സ്ഥാനം അടിസ്ഥാനമാക്കി കണക്കാക്കുന്നു; അഭ്യർത്ഥിക്കുമ്പോൾ അത് AlAdhan-ന് കൈമാറുന്നു. സ്ഥാനം കൃത്യമായിരിക്കണമെന്നില്ല. അത് ബ്രൗസർ സംഭരണത്തിൽ സൂക്ഷിക്കില്ല.", ar: "تُحسب الأوقات من إحداثيات GPS بالمتصفح وتُرسل إلى AlAdhan عند طلب المواقيت. دقة الموقع غير مضمونة ولا تُخزَّن الإحداثيات في المتصفح." },
  footerDistrict: { en: "District times are calculated for each district headquarters. Use the location button for GPS-based timings.", ml: "ഓരോ ജില്ലാ ആസ്ഥാനത്തിനുമുള്ള സമയമാണ് കാണിക്കുന്നത്. GPS സമയത്തിന് സ്ഥാനം ബട്ടൺ ഉപയോഗിക്കുക.", ar: "تُحسب الأوقات لمركز كل منطقة. استخدم زر الموقع للحصول على مواقيت بحسب GPS." },
  footerEstimate: { en: "These are API-calculated estimates for the selected district or GPS location, not verified local mosque timetable times.", ml: "ഇവ തിരഞ്ഞെടുത്ത ജില്ല/GPS സ്ഥാനത്തെ API കണക്കുകൂട്ടലുകളാണ്; പള്ളിയുടെ സ്ഥിരീകരിച്ച സമയങ്ങളല്ല.", ar: "هذه أوقات تقديرية محسوبة إلكترونيًا للمنطقة أو موقع GPS، وليست مواعيد معتمدة من المسجد المحلي." },
  footerSharing: { en: "GPS-based API requests share browser-provided coordinates with AlAdhan, not our backend.", ml: "GPS അഭ്യർത്ഥനകൾ ബ്രൗസർ നൽകുന്ന സ്ഥാനം AlAdhan-ന് കൈമാറുന്നു; നമ്മുടെ സെർവറിലേക്കല്ല.", ar: "تُرسل إحداثيات GPS إلى AlAdhan وليس إلى خادمنا." },
  photography: { en: "Architecture photography from", ml: "കെട്ടിട ചിത്രങ്ങൾ", ar: "صور العمارة من" },
} as const;
export type Key = keyof typeof dict;
export const tr = (lang: Lang) => (k: Key) => dict[k][lang];

/** Arabic display labels for Kerala districts; only the UI uses these. */
const DISTRICT_AR = {
  "tvm": "تيروفانانثابورام",
  "klm": "كولام",
  "pta": "باثانامثيتا",
  "alp": "ألابوزا",
  "ktm": "كوتايام",
  "idk": "إدوكي",
  "ekm": "إرناكولام",
  "tsr": "تريشور",
  "pkd": "بالاكاد",
  "mlp": "مالابورام",
  "kkd": "كوزيكود",
  "wyd": "واياناد",
  "knr": "كانور",
  "ksd": "كاساراغود"
} as const;
export const arabicDistrictName = (id: string) => DISTRICT_AR[id as keyof typeof DISTRICT_AR] ?? id;

/** Display only: standard Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩).
 * Never convert API values, HTML attributes, IDs or stored settings. */
export function localizeDigits(value: string | number, lang: Lang): string {
  const text = String(value);
  return lang === "ar"
    ? text.replace(/[0-9]/g, (digit) => String.fromCharCode(0x0660 + Number(digit)))
    : text;
}
