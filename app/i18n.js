const LOCALE_KEY = "nail-guard.locale.v1";

export const SUPPORTED_LOCALES = ["de", "en"];

const translations = {
  de: {
    "app.title": "Tawel",
    "neutral.title": "Daily Board",

    "state.calm": "Ruhig",
    "state.calmHint": "Tawel begleitet dich im Hintergrund — alles bleibt auf deinem Gerät",
    "state.warm": "Achtsam",
    "state.warmHint": "Deine Hand ist nah am Gesicht",
    "state.ember": "Innehalten",
    "state.emberHint": "Ein ruhiger Atemzug genügt",
    "state.paused": "Pausiert",
    "state.pausedHint": "Alles ruht, bis du fortsetzt",

    "status.loadingModel": "Erkennung wird vorbereitet …",
    "status.openingCamera": "Kamera wird geöffnet …",

    "aria.topbar": "App Status",
    "aria.modeTabs": "App-Modus",
    "aria.proximity": "Nähe zum Mund",
    "aria.presets": "Voreinstellung",
    "aria.languageToggle": "Sprache",
    "aria.hourBars": "Momente pro Stunde",

    "start.title": "Ein ruhiger Coach für fokussierte Momente.",
    "start.body":
      "Starte die Kamera, wähle deinen Modus und lass Tawel leise im Hintergrund mitlaufen. Es werden keine Webcam-Bilder oder Videos gespeichert oder hochgeladen.",
    "start.privacy":
      "MediaPipe Bibliothek, WASM und Modelle werden lokal von dieser Website geladen. Kameradaten bleiben im Browser.",
    "start.titleNeutral": "Bereit für einen ruhigen Arbeitstag.",
    "start.bodyNeutral":
      "Diese Seite bleibt lokal in deinem Browser aktiv. Es werden keine Bilder oder Videos gespeichert oder hochgeladen.",
    "start.privacyNeutral":
      "Bibliothek und Modelle werden lokal von dieser Website geladen. Lokale Daten bleiben auf diesem Gerät.",
    "start.button": "Kamera starten",
    "start.retry": "Erneut versuchen",
    "start.desktopLink": "Desktop-App kommt bald – zur Warteliste",
    "start.step1": "Kamera erlauben",
    "start.step1Desc": "Die Erkennung läuft vollständig im Browser – nichts verlässt dein Gerät.",
    "start.step2": "Kurz kalibrieren",
    "start.step2Desc": "Finger zum Mund führen: Tawel lernt deinen persönlichen Abstand.",
    "start.step3": "Einfach weiterarbeiten",
    "start.step3Desc": "Sanfte Hinweise wenn nötig, sonst läuft alles unsichtbar im Hintergrund.",

    "tabs.focus": "Focus",
    "tabs.calibration": "Einstellungen",
    "tabs.review": "Review",

    "focus.openOffice": "Office Mode",
    "focus.pause": "Pausieren",
    "focus.resume": "Fortsetzen",
    "focus.quietTime": "Ruhige Zeit",
    "focus.momentsToday": "Momente heute",

    "signals.faceWaiting": "Gesicht: bereit, sobald du im Bild bist",
    "signals.faceDetected": "Gesicht: erkannt",
    "signals.faceSearching": "Gesicht: noch nicht im Bild",
    "signals.handWaiting": "Hand: bereit, sobald sie im Bild ist",
    "signals.handDetected": "Hand: {count} erkannt",
    "signals.handSearching": "Hand: noch nicht im Bild",
    "signals.nearWaiting": "Nähe: misst, sobald beides im Bild ist",
    "signals.nearCalm": "Nähe: ruhig",
    "signals.nearClose": "Nähe: nahe",
    "signals.distanceEmpty": "Distanz: sobald deine Hand im Bild ist",
    "signals.distance": "Distanz: {value}",

    "settings.title": "Einstellungen",
    "settings.cameraTitle": "Kamera",
    "settings.cameraDetails": "Vorschau & Live-Signale",
    "settings.fineTune": "Feinjustierung",
    "settings.cameraSelectLabel": "Gerät",
    "settings.cameraDevice": "Kamera",
    "settings.detectionTitle": "Erkennung",
    "settings.cuesTitle": "Hinweise",
    "settings.privacyTitle": "Privatsphäre",
    "settings.privacyBody":
      "Die Auswertung läuft vollständig auf deinem Gerät. Es wird kein Bild oder Video gespeichert oder übertragen.",
    "settings.sensitivityDesc": "Wie nah die Hand dem Mund kommen darf",
    "settings.holdDesc": "Dauer, bis der Hinweis kommt",
    "settings.cooldownDesc": "Pause, bis der nächste Hinweis kommen darf",
    "settings.warmthDesc": "Ring wärmt sich auf, wenn die Hand näher kommt",
    "settings.overlayDesc": "Zeigt erkannte Punkte im Kamerabild",
    "settings.soundDesc": "Leiser Klang beim Hinweis",
    "settings.vibrationDesc": "Kurzes Vibrieren beim Hinweis",
    "settings.soundChoice": "Klang",
    "settings.faceTouchDesc": "Reagiert auf jede Berührung des Gesichts, nicht nur am Mund",
    "settings.officeTitle": "Office Mode",
    "settings.officeDot": "Status-Punkt anzeigen",
    "settings.officeDotDesc": "Kleiner Punkt zeigt den Erkennungszustand in der Tarnansicht",
    "settings.officeLayout": "Tarn-Layout",
    "settings.officeLayoutDesc": "Die Tarnansicht ist ein schlichter Texteditor",
    "settings.officeLayoutValue": "Notizen.txt",
    "settings.officeSubtleDesc": "Hinweise erscheinen nur als kleine Notiz am Rand",
    "settings.dataTitle": "Daten",
    "settings.dataExport": "Exportieren",
    "settings.dataExportDesc": "Statistiken, Streak und Einstellungen als JSON-Datei sichern",
    "settings.dataImport": "Importieren",
    "settings.dataImportDesc": "Backup-Datei einlesen; vorhandene Daten werden ersetzt",

    "calibration.testWarning": "Probe-Hinweis ansehen",
    "presets.soft": "Sanft",
    "presets.normal": "Normal",
    "presets.precise": "Präzise",
    "calibration.sensitivity": "Empfindlichkeit",
    "calibration.holdTime": "Haltezeit",
    "calibration.cooldown": "Ruhepause",
    "calibration.faceTouch": "Gesichtsberührung melden",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Farbwarnung",
    "calibration.sound": "Ton",
    "calibration.vibration": "Vibration",
    "calibration.volume": "Lautstärke",
    "calibration.testSound": "Test",
    "calibration.recalibrate": "Abstand neu einrichten",

    "sounds.bubblePop": "Bubble Pop",
    "sounds.doubleTap": "Doppel-Klopfen",
    "sounds.breathBell": "Atem-Glocke",
    "sounds.tinyRobot": "Mini-Roboter",
    "sounds.boing": "Boing",

    "review.today": "Heute, {date}",
    "review.statQuiet": "Ruhige Zeit",
    "review.vsYesterday": "vs. gestern",
    "review.hourTitle": "Momente im Tagesverlauf",
    "review.legendCalm": "ruhig",
    "review.legendPeak": "häufige Momente",
    "review.feedbackTitle": "Dein Feedback",
    "review.statConfirmed": "Treffer",
    "review.statFalse": "Fehlalarme",
    "review.statFace": "Gesicht berührt",
    "review.streakStrong": "{days} Tage in Folge",
    "review.streakStrongOne": "1 Tag",
    "review.streakRest": "mit weniger als fünf Momenten.",
    "review.streakKeepGoing": "Weiter so — ruhig und ohne Druck.",
    "review.streakZero": "Jeder ruhige Tag zählt. Heute ist ein guter Start.",
    "review.reset": "Statistik zurücksetzen",

    "neutral.subtle": "Sehr dezente Einblendung",
    "neutral.exitTitle": "Office Mode beenden",

    "office.escHintTitle": "Office Mode aktiv",
    "office.escHintText": "Zurück mit Esc – oder per Klick auf den Punkt in der Fußzeile",
    "office.menuFile": "Datei",
    "office.menuEdit": "Bearbeiten",
    "office.menuFormat": "Format",
    "office.placeholder": "Schreiben …",
    "office.autosaved": "Automatisch gespeichert",
    "office.wordOne": "1 Wort",
    "office.wordOther": "{count} Wörter",
    "office.sampleNotes":
      "Besprechung Donnerstag\n- Angebot bis Ende der Woche fertigstellen\n- Rückmeldung an das Team\n- Termine für nächste Woche abstimmen\n",

    "alert.title": "Kurz innehalten",
    "alert.body": "Atme einmal tief ein und wieder aus.",

    "onboarding.eyebrow": "Kurz einrichten",
    "onboarding.skip": "Überspringen",
    "onboarding.finish": "Los geht's",
    "onboarding.step1Title": "Schau kurz in die Kamera",
    "onboarding.step1Body":
      "Setz dich bequem hin und schau in die Kamera, bis dein Gesicht erkannt wird.",
    "onboarding.step2Title": "Zeig eine Hand",
    "onboarding.step2Body": "Heb eine Hand, sodass die Kamera deine Finger sehen kann.",
    "onboarding.step3Title": "Führe einen Finger zum Mund",
    "onboarding.step3Body":
      "Führe einen Finger langsam zum Mund und halte ihn dort einen Moment. So lernt Tawel deinen Abstand zur Kamera kennen.",
    "onboarding.step4Title": "Alles eingestellt",
    "onboarding.step4Body":
      "Die Empfindlichkeit ist jetzt auf deine Kamera und Sitzposition abgestimmt. Du kannst sie jederzeit unter Einstellungen ändern.",
    "onboarding.waitingFace": "Die Kamera sucht dich noch …",
    "onboarding.foundFace": "Gesicht erkannt",
    "onboarding.waitingHand": "Die Kamera sucht deine Hand noch …",
    "onboarding.foundHand": "Hand erkannt",
    "onboarding.moveCloser": "Finger noch näher zum Mund …",
    "onboarding.holdNearMouth": "Gut, kurz so halten …",
    "onboarding.captured": "Erfasst — das war's schon.",

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
      "In In-App-Browsern (etwa aus einer Messenger-App heraus) ist die Kamera oft nicht erlaubt.",
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
    "errors.importFailed": "Die Backup-Datei konnte nicht importiert werden.",
    "errors.importFailedHint1":
      "Bitte eine unveränderte tawel-backup-….json Datei aus dem Export verwenden.",
    "errors.generic": "Die App konnte nicht starten.",
    "errors.genericHint1": "Beim allerersten Start braucht die Erkennung einmal Internet — danach läuft alles lokal.",
    "errors.genericHint2": "Prüfe die Browser-Kamerafreigabe.",
    "errors.genericHint3": "Lade die Seite neu und versuche es erneut.",
  },

  en: {
    "app.title": "Tawel",
    "neutral.title": "Daily Board",

    "state.calm": "Calm",
    "state.calmHint": "Tawel runs quietly in the background — everything stays on your device",
    "state.warm": "Mindful",
    "state.warmHint": "Your hand is close to your face",
    "state.ember": "Hold on",
    "state.emberHint": "One calm breath is enough",
    "state.paused": "Paused",
    "state.pausedHint": "Everything rests until you resume",

    "status.loadingModel": "Getting detection ready …",
    "status.openingCamera": "Opening camera …",

    "aria.topbar": "App status",
    "aria.modeTabs": "App mode",
    "aria.proximity": "Proximity to mouth",
    "aria.presets": "Preset",
    "aria.languageToggle": "Language",
    "aria.hourBars": "Moments per hour",

    "start.title": "A calm coach for focused moments.",
    "start.body":
      "Start the camera, pick your mode and let Tawel run quietly in the background. No webcam images or videos are stored or uploaded.",
    "start.privacy":
      "The MediaPipe library, WASM and models are served locally by this website. Camera data stays in your browser.",
    "start.titleNeutral": "Ready for a calm workday.",
    "start.bodyNeutral":
      "This page runs locally in your browser. No images or videos are stored or uploaded.",
    "start.privacyNeutral":
      "The library and models are served locally by this website. Local data stays on this device.",
    "start.button": "Start camera",
    "start.retry": "Try again",
    "start.desktopLink": "Desktop app coming soon – join the waitlist",
    "start.step1": "Allow camera",
    "start.step1Desc": "Detection runs entirely in your browser — nothing leaves your device.",
    "start.step2": "Quick calibration",
    "start.step2Desc": "Bring a finger to your mouth: Tawel learns your personal distance.",
    "start.step3": "Just keep working",
    "start.step3Desc": "Gentle nudges when needed; otherwise it runs invisibly in the background.",

    "tabs.focus": "Focus",
    "tabs.calibration": "Settings",
    "tabs.review": "Review",

    "focus.openOffice": "Office Mode",
    "focus.pause": "Pause",
    "focus.resume": "Resume",
    "focus.quietTime": "Quiet time",
    "focus.momentsToday": "Moments today",

    "signals.faceWaiting": "Face: ready once you're in view",
    "signals.faceDetected": "Face: detected",
    "signals.faceSearching": "Face: not in view yet",
    "signals.handWaiting": "Hand: ready once it's in view",
    "signals.handDetected": "Hands: {count} detected",
    "signals.handSearching": "Hand: not in view yet",
    "signals.nearWaiting": "Proximity: measures once both are in view",
    "signals.nearCalm": "Proximity: calm",
    "signals.nearClose": "Proximity: close",
    "signals.distanceEmpty": "Distance: once your hand is in view",
    "signals.distance": "Distance: {value}",

    "settings.title": "Settings",
    "settings.cameraTitle": "Camera",
    "settings.cameraDetails": "Preview & live signals",
    "settings.fineTune": "Fine-tuning",
    "settings.cameraSelectLabel": "Device",
    "settings.cameraDevice": "Camera",
    "settings.detectionTitle": "Detection",
    "settings.cuesTitle": "Cues",
    "settings.privacyTitle": "Privacy",
    "settings.privacyBody":
      "All processing happens entirely on your device. No image or video is ever stored or transmitted.",
    "settings.sensitivityDesc": "How close your hand may come to your mouth",
    "settings.holdDesc": "Time until the nudge appears",
    "settings.cooldownDesc": "Pause before the next nudge may appear",
    "settings.warmthDesc": "The ring warms up as your hand comes closer",
    "settings.overlayDesc": "Shows detected points in the camera image",
    "settings.soundDesc": "A quiet sound with each nudge",
    "settings.vibrationDesc": "A short vibration with each nudge",
    "settings.soundChoice": "Sound",
    "settings.faceTouchDesc": "Reacts to any touch of the face, not just near the mouth",
    "settings.officeTitle": "Office Mode",
    "settings.officeDot": "Show status dot",
    "settings.officeDotDesc": "A small dot shows the detection state in the disguised view",
    "settings.officeLayout": "Disguise layout",
    "settings.officeLayoutDesc": "The disguised view is a plain text editor",
    "settings.officeLayoutValue": "Notes.txt",
    "settings.officeSubtleDesc": "Nudges appear only as a small note at the edge",
    "settings.dataTitle": "Data",
    "settings.dataExport": "Export",
    "settings.dataExportDesc": "Save statistics, streak and settings as a JSON file",
    "settings.dataImport": "Import",
    "settings.dataImportDesc": "Read a backup file; existing data will be replaced",

    "calibration.testWarning": "Preview a nudge",
    "presets.soft": "Gentle",
    "presets.normal": "Normal",
    "presets.precise": "Precise",
    "calibration.sensitivity": "Sensitivity",
    "calibration.holdTime": "Hold time",
    "calibration.cooldown": "Quiet gap",
    "calibration.faceTouch": "Report face touches",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Color cue",
    "calibration.sound": "Sound",
    "calibration.vibration": "Vibration",
    "calibration.volume": "Volume",
    "calibration.testSound": "Test",
    "calibration.recalibrate": "Redo distance setup",

    "sounds.bubblePop": "Bubble pop",
    "sounds.doubleTap": "Double tap",
    "sounds.breathBell": "Breath bell",
    "sounds.tinyRobot": "Tiny robot",
    "sounds.boing": "Boing",

    "review.today": "Today, {date}",
    "review.statQuiet": "Quiet time",
    "review.vsYesterday": "vs. yesterday",
    "review.hourTitle": "Moments through the day",
    "review.legendCalm": "calm",
    "review.legendPeak": "frequent moments",
    "review.feedbackTitle": "Your feedback",
    "review.statConfirmed": "Hits",
    "review.statFalse": "False alarms",
    "review.statFace": "Face touches",
    "review.streakStrong": "{days} days in a row",
    "review.streakStrongOne": "1 day",
    "review.streakRest": "with fewer than five moments.",
    "review.streakKeepGoing": "Keep going — calm and without pressure.",
    "review.streakZero": "Every calm day counts. Today is a good start.",
    "review.reset": "Reset statistics",

    "neutral.subtle": "Very subtle notifications",
    "neutral.exitTitle": "Exit Office Mode",

    "office.escHintTitle": "Office Mode on",
    "office.escHintText": "Leave with Esc — or click the dot in the footer",
    "office.menuFile": "File",
    "office.menuEdit": "Edit",
    "office.menuFormat": "Format",
    "office.placeholder": "Write …",
    "office.autosaved": "Saved automatically",
    "office.wordOne": "1 word",
    "office.wordOther": "{count} words",
    "office.sampleNotes":
      "Meeting Thursday\n- Finish the proposal by end of week\n- Reply to the team\n- Align on next week's schedule\n",

    "alert.title": "Hold on for a moment",
    "alert.body": "Take one deep breath in and out.",

    "onboarding.eyebrow": "Quick setup",
    "onboarding.skip": "Skip",
    "onboarding.finish": "Let's go",
    "onboarding.step1Title": "Look at the camera",
    "onboarding.step1Body": "Sit comfortably and look at the camera until your face is detected.",
    "onboarding.step2Title": "Show one hand",
    "onboarding.step2Body": "Raise a hand so the camera can see your fingers.",
    "onboarding.step3Title": "Bring a finger to your mouth",
    "onboarding.step3Body":
      "Slowly bring a finger to your mouth and hold it there for a moment. This teaches Tawel your distance from the camera.",
    "onboarding.step4Title": "All set",
    "onboarding.step4Body":
      "Sensitivity is now tuned to your camera and seating position. You can change it anytime in Settings.",
    "onboarding.waitingFace": "The camera is still looking for you …",
    "onboarding.foundFace": "Face detected",
    "onboarding.waitingHand": "Still looking for your hand …",
    "onboarding.foundHand": "Hand detected",
    "onboarding.moveCloser": "Bring your finger closer to your mouth …",
    "onboarding.holdNearMouth": "Good, hold it there …",
    "onboarding.captured": "Got it — that's all.",

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
    "errors.importFailed": "The backup file could not be imported.",
    "errors.importFailedHint1":
      "Please use an unmodified tawel-backup-….json file from the export.",
    "errors.generic": "The app could not start.",
    "errors.genericHint1": "The very first start needs an internet connection — after that everything runs locally.",
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

  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  }
}
