const LOCALE_KEY = "nail-guard.locale.v1";

export const SUPPORTED_LOCALES = ["de", "en"];

const translations = {
  de: {
    "app.eyebrow": "Calm habit coach",
    "app.title": "Nail Guard",
    "neutral.eyebrow": "Workspace",
    "neutral.title": "Daily Board",

    "status.ready": "Bereit",
    "status.loadingModel": "Modell lädt",
    "status.openingCamera": "Kamera wird geöffnet",
    "status.active": "Aktiv",
    "status.paused": "Pausiert",
    "status.error": "Fehler",
    "status.miniReset": "Mini-Reset",

    "aria.topbar": "App Status",
    "aria.modeTabs": "App-Modus",
    "aria.proximity": "Nähe zum Mund",
    "aria.calibration": "Kalibrierung",
    "aria.presets": "Voreinstellung",
    "aria.neutralToolbar": "Neutrale Ansicht",
    "aria.languageToggle": "Sprache",

    "start.title": "Ein ruhiger Coach für fokussierte Momente.",
    "start.body":
      "Starte die Kamera, wähle deinen Modus und lass Nail Guard leise im Hintergrund mitlaufen. Es werden keine Webcam-Bilder oder Videos gespeichert oder hochgeladen.",
    "start.privacy":
      "MediaPipe Bibliothek, WASM und Modelle werden aktuell extern geladen. Kameradaten bleiben im Browser.",
    "start.titleNeutral": "Bereit für einen ruhigen Arbeitstag.",
    "start.bodyNeutral":
      "Diese Seite bleibt lokal in deinem Browser aktiv. Es werden keine Bilder oder Videos gespeichert oder hochgeladen.",
    "start.privacyNeutral":
      "Externe Bibliothek und Modelle werden geladen. Lokale Daten bleiben auf diesem Gerät.",
    "start.button": "Kamera starten",
    "start.retry": "Erneut versuchen",
    "start.desktopLink": "Desktop-App kommt bald – zur Warteliste",

    "tabs.focus": "Focus",
    "tabs.calibration": "Einstellungen",
    "tabs.review": "Review",
    "tabs.neutral": "Office",

    "focus.eyebrow": "Status",
    "focus.copy": "Ein ruhiger Begleiter im Hintergrund. Du kannst einfach weiterarbeiten.",
    "focus.openOffice": "Office Mode öffnen",
    "focus.pause": "Pause",
    "focus.resume": "Fortsetzen",
    "focus.quietTime": "Ruhige Zeit",
    "focus.interruptedToday": "Heute unterbrochen",

    "signals.faceWaiting": "Gesicht: wartet",
    "signals.faceDetected": "Gesicht: erkannt",
    "signals.faceSearching": "Gesicht: sucht",
    "signals.handWaiting": "Hand: wartet",
    "signals.handDetected": "Hand: {count} erkannt",
    "signals.handSearching": "Hand: sucht",
    "signals.nearWaiting": "Nähe: wartet",
    "signals.nearCalm": "Nähe: ruhig",
    "signals.nearClose": "Nähe: nahe",
    "signals.distanceEmpty": "Distanz: --",
    "signals.distance": "Distanz: {value}",

    "calibration.title": "Erweiterte Einstellungen",
    "calibration.testWarning": "Mini-Reset testen",
    "presets.soft": "Sanft",
    "presets.normal": "Normal",
    "presets.precise": "Präzise",
    "calibration.showTechnical": "Technische Werte anzeigen",
    "calibration.sensitivity": "Sensitivität",
    "calibration.holdTime": "Haltezeit",
    "calibration.cooldown": "Cooldown",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Farbwechsel",
    "calibration.sound": "Ton",
    "calibration.vibration": "Vibration",
    "calibration.volume": "Lautstärke",
    "calibration.testSound": "Test",

    "sounds.softChime": "Sanfter Gong",
    "sounds.breathBell": "Atem-Glocke",
    "sounds.doubleTap": "Doppel-Klopfen",
    "sounds.bubblePop": "Bubble Pop",
    "sounds.tinyRobot": "Mini-Roboter",
    "sounds.boing": "Boing",

    "review.eyebrow": "Heute",
    "review.summaryQuiet": "Heute läuft ruhig. Ein guter Moment, um einfach weiterzumachen.",
    "review.summaryNoConfirmed": "{duration} ruhige Phase. Du bleibst aufmerksam, ohne Druck.",
    "review.summaryConfirmed": "{count} Treffer heute. Der nächste ruhige Abschnitt beginnt jetzt.",
    "review.lastWarningNone": "Letzter Mini-Reset: keiner",
    "review.lastWarningAt": "Letzter Mini-Reset: {time}",
    "review.statWarnings": "Unterbrochene Momente",
    "review.statConfirmed": "Treffer",
    "review.statFalse": "Fehlalarme",
    "review.statFace": "Gesicht berührt",
    "review.statLongest": "Längste ruhige Phase",
    "review.statQuiet": "Ruhige Zeit",
    "review.reset": "Statistik zurücksetzen",

    "neutral.view": "Ansicht",
    "neutral.layout.clock": "Uhr & Datum",
    "neutral.layout.timer": "Fokus-Timer",
    "neutral.layout.notes": "Notizseite",
    "neutral.layout.plan": "Tagesplan",
    "neutral.layout.breathing": "Atemübung",
    "neutral.layout.water": "Wasser-Reminder",
    "neutral.layout.calendar": "Kalender-Look",
    "neutral.layout.dashboard": "Minimal Dashboard",
    "neutral.layout.reading": "Lesemodus",
    "neutral.layout.blank": "Blank Screen",
    "neutral.subtle": "Sehr dezente Einblendung",
    "neutral.kickerWorkspace": "Workspace",
    "neutral.today": "Heute",
    "neutral.active": "Aktiv",
    "neutral.focusRunning": "Fokuszeit läuft",
    "neutral.fauxPause": "Pause",
    "neutral.notesKicker": "Gedanken / To-dos",
    "neutral.planTitle": "Tagesplan",
    "neutral.plan1": "Start & Überblick",
    "neutral.plan2": "Konzentrierter Block",
    "neutral.plan3": "Kurzer Check-in",
    "neutral.plan4": "Abschlussrunde",
    "neutral.breatheIn": "Einatmen",
    "neutral.breatheOut": "Ausatmen",
    "neutral.waterTitle": "Wasser trinken",
    "neutral.waterGlasses": "Gläser heute",
    "neutral.cal1": "Planung",
    "neutral.cal2": "Arbeitsblock",
    "neutral.cal3": "Review",
    "neutral.cal4": "Wrap-up",
    "neutral.readingKicker": "Lesemodus",
    "neutral.readingTitle": "Ruhig arbeiten",
    "neutral.readingBody":
      "Ein klarer Block, eine kleine Aufgabe, ein nächster Schritt. Weniger Wechsel, mehr Aufmerksamkeit. Danach kurz sammeln und weitergehen.",

    "alert.eyebrow": "Kurzer Moment",
    "alert.title": "Mini-Reset",
    "alert.body": "3 Atemzüge. Zurück zum Fokus.",
    "alert.hit": "Treffer",
    "alert.false": "Fehlalarm",
    "alert.face": "Gesicht berührt",

    "onboarding.eyebrow": "Kurze Kalibrierung",
    "onboarding.skip": "Überspringen",
    "onboarding.finish": "Los geht's",
    "onboarding.step1Title": "Schau kurz in die Kamera",
    "onboarding.step1Body":
      "Setz dich bequem hin und schau in die Kamera, bis dein Gesicht erkannt wird.",
    "onboarding.step2Title": "Zeig eine Hand",
    "onboarding.step2Body": "Heb eine Hand, sodass die Kamera deine Finger sehen kann.",
    "onboarding.step3Title": "Führe einen Finger zum Mund",
    "onboarding.step3Body":
      "Führe einen Finger langsam zum Mund und halte ihn dort einen Moment. So lernt Nail Guard deinen Abstand zur Kamera kennen.",
    "onboarding.step4Title": "Alles eingestellt",
    "onboarding.step4Body":
      "Die Empfindlichkeit ist jetzt auf deine Kamera und Sitzposition abgestimmt. Du kannst sie jederzeit unter Einstellungen ändern.",
    "onboarding.waitingFace": "Gesicht: wird gesucht …",
    "onboarding.foundFace": "Gesicht erkannt",
    "onboarding.waitingHand": "Hand: wird gesucht …",
    "onboarding.foundHand": "Hand erkannt",
    "onboarding.moveCloser": "Finger noch näher zum Mund …",
    "onboarding.holdNearMouth": "Gut, kurz so halten …",
    "onboarding.captured": "Erfasst!",
    "calibration.recalibrate": "Kalibrierung neu starten",

    "landing.eyebrow": "Nail Guard Desktop",
    "landing.title": "Nail Guard Desktop",
    "landing.heroTitle": "Der Ganztags-Begleiter gegen Nägelkauen.",
    "landing.heroBody":
      "Die Web-App wirkt, solange der Tab offen ist. Die Desktop-App begleitet dich den ganzen Arbeitstag: Sie startet beim Anmelden, läuft unauffällig in der Menüleiste und erinnert dich mit sanften System-Hinweisen – ohne dass ein einziges Bild deinen Rechner verlässt.",
    "landing.prop1Title": "Den ganzen Tag",
    "landing.prop1Body":
      "Startet automatisch beim Anmelden und wacht im Hintergrund – kein offener Browser-Tab nötig.",
    "landing.prop2Title": "100 % privat",
    "landing.prop2Body":
      "Die Auswertung läuft komplett lokal auf deinem Gerät. Keine Cloud, keine Accounts, kein Tracking.",
    "landing.prop3Title": "Sanfte Hinweise",
    "landing.prop3Body":
      "System-Benachrichtigungen und dezente Bildschirm-Hinweise statt greller Alarme.",
    "landing.waitlistTitle": "Komm auf die Warteliste",
    "landing.waitlistBody":
      "Trag deine E-Mail-Adresse ein und erfahre als Erste:r, wenn die Desktop-App für macOS und Windows bereit ist.",
    "landing.emailLabel": "E-Mail-Adresse",
    "landing.emailPlaceholder": "deine@email.de",
    "landing.submit": "Eintragen",
    "landing.success": "Danke! Du stehst auf der Liste.",
    "landing.invalid": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "landing.error": "Das hat gerade nicht geklappt. Bitte versuch es später noch einmal.",
    "landing.notConfigured": "Die Warteliste ist noch nicht freigeschaltet. Schau bald wieder vorbei.",
    "landing.privacy": "Deine E-Mail-Adresse wird nur für die Benachrichtigung zur Desktop-App verwendet.",
    "landing.tryWeb": "Jetzt im Browser ausprobieren",

    replacements: [
      "Faust 10 Sekunden ballen",
      "Hände auf Oberschenkel legen",
      "Stressball nehmen",
      "3 tiefe Atemzüge",
      "Wasser trinken",
    ],
    neutralInterventions: [
      ["Mini-Reset", "Zurück zum Fokus"],
      ["Kurze Pause", "Schultern locker"],
      ["Atmen", "3 Atemzüge"],
      ["Zurück zum Fokus", "Ruhig weiter"],
    ],

    "errors.cameraBlocked": "Kamerazugriff wurde blockiert.",
    "errors.cameraBlockedHint1":
      "Im in-app Browser kann die Kamera je nach Berechtigungssituation blockiert sein.",
    "errors.cameraBlockedHint2":
      "Öffne {origin} in Chrome oder Safari und erlaube die Kamera in der Adressleiste.",
    "errors.cameraBlockedHint3":
      "Falls du zuvor blockiert hast: Website-Einstellungen öffnen, Kamera auf Erlauben setzen und Seite neu laden.",
    "errors.noCamera": "Keine Kamera gefunden.",
    "errors.noCameraHint1": "Prüfe, ob eine Webcam angeschlossen ist.",
    "errors.noCameraHint2": "Schließe Apps, die die Kamera bereits verwenden.",
    "errors.noCameraHint3": "Lade die Seite neu und versuche es erneut.",
    "errors.noGetUserMedia": "Dieser Browser unterstützt keinen direkten Kamerazugriff.",
    "errors.noGetUserMediaHint1": "Nutze Chrome, Safari oder Edge.",
    "errors.noGetUserMediaHint2":
      "Öffne die App über HTTPS oder lokal über http://localhost, nicht direkt als Datei.",
    "errors.generic": "Die App konnte nicht starten.",
    "errors.genericHint1": "Prüfe die Internetverbindung für den ersten MediaPipe-Download.",
    "errors.genericHint2": "Prüfe die Browser-Kamerafreigabe.",
    "errors.genericHint3": "Lade die Seite neu und versuche es erneut.",
  },

  en: {
    "app.eyebrow": "Calm habit coach",
    "app.title": "Nail Guard",
    "neutral.eyebrow": "Workspace",
    "neutral.title": "Daily Board",

    "status.ready": "Ready",
    "status.loadingModel": "Loading model",
    "status.openingCamera": "Opening camera",
    "status.active": "Active",
    "status.paused": "Paused",
    "status.error": "Error",
    "status.miniReset": "Mini reset",

    "aria.topbar": "App status",
    "aria.modeTabs": "App mode",
    "aria.proximity": "Proximity to mouth",
    "aria.calibration": "Calibration",
    "aria.presets": "Preset",
    "aria.neutralToolbar": "Neutral view",
    "aria.languageToggle": "Language",

    "start.title": "A calm coach for focused moments.",
    "start.body":
      "Start the camera, pick your mode and let Nail Guard run quietly in the background. No webcam images or videos are stored or uploaded.",
    "start.privacy":
      "The MediaPipe library, WASM and models are currently loaded from external CDNs. Camera data stays in your browser.",
    "start.titleNeutral": "Ready for a calm workday.",
    "start.bodyNeutral":
      "This page runs locally in your browser. No images or videos are stored or uploaded.",
    "start.privacyNeutral":
      "An external library and models are loaded. Local data stays on this device.",
    "start.button": "Start camera",
    "start.retry": "Try again",
    "start.desktopLink": "Desktop app coming soon – join the waitlist",

    "tabs.focus": "Focus",
    "tabs.calibration": "Settings",
    "tabs.review": "Review",
    "tabs.neutral": "Office",

    "focus.eyebrow": "Status",
    "focus.copy": "A calm companion in the background. You can simply keep working.",
    "focus.openOffice": "Open Office Mode",
    "focus.pause": "Pause",
    "focus.resume": "Resume",
    "focus.quietTime": "Quiet time",
    "focus.interruptedToday": "Interruptions today",

    "signals.faceWaiting": "Face: waiting",
    "signals.faceDetected": "Face: detected",
    "signals.faceSearching": "Face: searching",
    "signals.handWaiting": "Hand: waiting",
    "signals.handDetected": "Hands: {count} detected",
    "signals.handSearching": "Hand: searching",
    "signals.nearWaiting": "Proximity: waiting",
    "signals.nearCalm": "Proximity: calm",
    "signals.nearClose": "Proximity: close",
    "signals.distanceEmpty": "Distance: --",
    "signals.distance": "Distance: {value}",

    "calibration.title": "Advanced settings",
    "calibration.testWarning": "Test mini reset",
    "presets.soft": "Gentle",
    "presets.normal": "Normal",
    "presets.precise": "Precise",
    "calibration.showTechnical": "Show technical values",
    "calibration.sensitivity": "Sensitivity",
    "calibration.holdTime": "Hold time",
    "calibration.cooldown": "Cooldown",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Color cue",
    "calibration.sound": "Sound",
    "calibration.vibration": "Vibration",
    "calibration.volume": "Volume",
    "calibration.testSound": "Test",

    "sounds.softChime": "Soft chime",
    "sounds.breathBell": "Breath bell",
    "sounds.doubleTap": "Double tap",
    "sounds.bubblePop": "Bubble pop",
    "sounds.tinyRobot": "Tiny robot",
    "sounds.boing": "Boing",

    "review.eyebrow": "Today",
    "review.summaryQuiet": "Today is going calmly. A good moment to simply keep going.",
    "review.summaryNoConfirmed": "{duration} of calm. You stay aware, without pressure.",
    "review.summaryConfirmed": "{count} hits today. The next calm stretch starts now.",
    "review.lastWarningNone": "Last mini reset: none",
    "review.lastWarningAt": "Last mini reset: {time}",
    "review.statWarnings": "Interrupted moments",
    "review.statConfirmed": "Hits",
    "review.statFalse": "False alarms",
    "review.statFace": "Face touches",
    "review.statLongest": "Longest calm stretch",
    "review.statQuiet": "Quiet time",
    "review.reset": "Reset statistics",

    "neutral.view": "View",
    "neutral.layout.clock": "Clock & date",
    "neutral.layout.timer": "Focus timer",
    "neutral.layout.notes": "Notes page",
    "neutral.layout.plan": "Day plan",
    "neutral.layout.breathing": "Breathing exercise",
    "neutral.layout.water": "Water reminder",
    "neutral.layout.calendar": "Calendar look",
    "neutral.layout.dashboard": "Minimal dashboard",
    "neutral.layout.reading": "Reading mode",
    "neutral.layout.blank": "Blank screen",
    "neutral.subtle": "Very subtle notifications",
    "neutral.kickerWorkspace": "Workspace",
    "neutral.today": "Today",
    "neutral.active": "Active",
    "neutral.focusRunning": "Focus time running",
    "neutral.fauxPause": "Pause",
    "neutral.notesKicker": "Thoughts / to-dos",
    "neutral.planTitle": "Day plan",
    "neutral.plan1": "Start & overview",
    "neutral.plan2": "Focused block",
    "neutral.plan3": "Quick check-in",
    "neutral.plan4": "Wrap-up",
    "neutral.breatheIn": "Breathe in",
    "neutral.breatheOut": "Breathe out",
    "neutral.waterTitle": "Drink water",
    "neutral.waterGlasses": "glasses today",
    "neutral.cal1": "Planning",
    "neutral.cal2": "Work block",
    "neutral.cal3": "Review",
    "neutral.cal4": "Wrap-up",
    "neutral.readingKicker": "Reading mode",
    "neutral.readingTitle": "Working calmly",
    "neutral.readingBody":
      "One clear block, one small task, one next step. Fewer switches, more attention. Then gather yourself briefly and move on.",

    "alert.eyebrow": "Quick moment",
    "alert.title": "Mini reset",
    "alert.body": "3 breaths. Back to focus.",
    "alert.hit": "Hit",
    "alert.false": "False alarm",
    "alert.face": "Face touch",

    "onboarding.eyebrow": "Quick calibration",
    "onboarding.skip": "Skip",
    "onboarding.finish": "Let's go",
    "onboarding.step1Title": "Look at the camera",
    "onboarding.step1Body": "Sit comfortably and look at the camera until your face is detected.",
    "onboarding.step2Title": "Show one hand",
    "onboarding.step2Body": "Raise a hand so the camera can see your fingers.",
    "onboarding.step3Title": "Bring a finger to your mouth",
    "onboarding.step3Body":
      "Slowly bring a finger to your mouth and hold it there for a moment. This teaches Nail Guard your distance from the camera.",
    "onboarding.step4Title": "All set",
    "onboarding.step4Body":
      "Sensitivity is now tuned to your camera and seating position. You can change it anytime in Settings.",
    "onboarding.waitingFace": "Face: searching …",
    "onboarding.foundFace": "Face detected",
    "onboarding.waitingHand": "Hand: searching …",
    "onboarding.foundHand": "Hand detected",
    "onboarding.moveCloser": "Bring your finger closer to your mouth …",
    "onboarding.holdNearMouth": "Good, hold it there …",
    "onboarding.captured": "Got it!",
    "calibration.recalibrate": "Restart calibration",

    "landing.eyebrow": "Nail Guard Desktop",
    "landing.title": "Nail Guard Desktop",
    "landing.heroTitle": "Your all-day companion against nail biting.",
    "landing.heroBody":
      "The web app helps while the tab is open. The desktop app stays with you through the whole workday: it starts at login, sits quietly in the menu bar and nudges you with gentle system notifications – without a single image ever leaving your computer.",
    "landing.prop1Title": "All day long",
    "landing.prop1Body":
      "Launches at login and watches in the background – no open browser tab required.",
    "landing.prop2Title": "100% private",
    "landing.prop2Body":
      "All processing happens locally on your device. No cloud, no accounts, no tracking.",
    "landing.prop3Title": "Gentle nudges",
    "landing.prop3Body":
      "System notifications and subtle on-screen cues instead of loud alarms.",
    "landing.waitlistTitle": "Join the waitlist",
    "landing.waitlistBody":
      "Leave your email and be the first to know when the desktop app for macOS and Windows is ready.",
    "landing.emailLabel": "Email address",
    "landing.emailPlaceholder": "you@email.com",
    "landing.submit": "Join",
    "landing.success": "Thanks! You're on the list.",
    "landing.invalid": "Please enter a valid email address.",
    "landing.error": "That didn't work just now. Please try again later.",
    "landing.notConfigured": "The waitlist isn't live yet. Please check back soon.",
    "landing.privacy": "Your email is only used to notify you about the desktop app.",
    "landing.tryWeb": "Try it in your browser now",

    replacements: [
      "Make a fist for 10 seconds",
      "Rest your hands on your thighs",
      "Grab a stress ball",
      "Take 3 deep breaths",
      "Drink some water",
    ],
    neutralInterventions: [
      ["Mini reset", "Back to focus"],
      ["Short break", "Relax your shoulders"],
      ["Breathe", "3 breaths"],
      ["Back to focus", "Carry on calmly"],
    ],

    "errors.cameraBlocked": "Camera access was blocked.",
    "errors.cameraBlockedHint1":
      "In-app browsers may block the camera depending on permissions.",
    "errors.cameraBlockedHint2":
      "Open {origin} in Chrome or Safari and allow camera access in the address bar.",
    "errors.cameraBlockedHint3":
      "If you blocked it earlier: open the site settings, set the camera to Allow and reload the page.",
    "errors.noCamera": "No camera found.",
    "errors.noCameraHint1": "Check that a webcam is connected.",
    "errors.noCameraHint2": "Close apps that are already using the camera.",
    "errors.noCameraHint3": "Reload the page and try again.",
    "errors.noGetUserMedia": "This browser does not support direct camera access.",
    "errors.noGetUserMediaHint1": "Use Chrome, Safari or Edge.",
    "errors.noGetUserMediaHint2":
      "Open the app via HTTPS or locally via http://localhost, not directly as a file.",
    "errors.generic": "The app could not start.",
    "errors.genericHint1": "Check your internet connection for the first MediaPipe download.",
    "errors.genericHint2": "Check the browser's camera permission.",
    "errors.genericHint3": "Reload the page and try again.",
  },
};

let currentLocale = detectLocale();

function detectLocale() {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch {
    // localStorage unavailable; fall through to browser language
  }

  return (navigator.language ?? "en").toLowerCase().startsWith("de") ? "de" : "en";
}

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  currentLocale = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // persisting the choice is best-effort
  }
}

export function t(key, params) {
  const value = translations[currentLocale][key] ?? translations.de[key] ?? key;
  if (typeof value !== "string" || !params) return value;

  return value.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

export function dateLocale() {
  return currentLocale === "de" ? "de-AT" : "en-US";
}

export function applyStaticTranslations(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }

  for (const el of root.querySelectorAll("[data-i18n-aria-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  }

  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) {
    el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder));
  }
}
