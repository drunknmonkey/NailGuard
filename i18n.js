const LOCALE_KEY = "nail-guard.locale.v1";

export const SUPPORTED_LOCALES = ["de", "en"];

const translations = {
  de: {
    "app.title": "Nail Guard",
    "neutral.title": "Daily Board",

    "state.calm": "Ruhig",
    "state.calmHint": "Nail Guard begleitet dich im Hintergrund — alles bleibt auf deinem Gerät",
    "state.warm": "Achtsam",
    "state.warmHint": "Deine Hand ist nah am Gesicht",
    "state.ember": "Innehalten",
    "state.emberHint": "",
    "state.paused": "Pausiert",
    "state.pausedHint": "Beobachtung ist ausgesetzt",

    "status.loadingModel": "Modell lädt …",
    "status.openingCamera": "Kamera wird geöffnet …",

    "aria.topbar": "App Status",
    "aria.modeTabs": "App-Modus",
    "aria.proximity": "Nähe zum Mund",
    "aria.presets": "Voreinstellung",
    "aria.languageToggle": "Sprache",
    "aria.hourBars": "Momente pro Stunde",

    "start.title": "Ein ruhiger Coach für fokussierte Momente.",
    "start.body":
      "Starte die Kamera, wähle deinen Modus und lass Nail Guard leise im Hintergrund mitlaufen. Es werden keine Webcam-Bilder oder Videos gespeichert oder hochgeladen.",
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

    "tabs.focus": "Focus",
    "tabs.calibration": "Einstellungen",
    "tabs.review": "Review",

    "focus.openOffice": "Office Mode",
    "focus.pause": "Pausieren",
    "focus.resume": "Fortsetzen",
    "focus.quietTime": "Ruhige Zeit",
    "focus.momentsToday": "Momente heute",

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

    "settings.title": "Einstellungen",
    "settings.cameraTitle": "Kamera",
    "settings.detectionTitle": "Erkennung",
    "settings.cuesTitle": "Hinweise",
    "settings.privacyTitle": "Privatsphäre",
    "settings.privacyBody":
      "Die Auswertung läuft vollständig auf deinem Gerät. Es wird kein Bild oder Video gespeichert oder übertragen.",
    "settings.sensitivityDesc": "Wie nah die Hand dem Mund kommen darf",
    "settings.holdDesc": "Dauer bis zur Intervention",
    "settings.cooldownDesc": "Pause zwischen zwei Interventionen",
    "settings.warmthDesc": "Ring wärmt sich auf, wenn die Hand näher kommt",
    "settings.overlayDesc": "Zeigt erkannte Punkte im Kamerabild",
    "settings.soundDesc": "Leiser Klang bei Intervention",
    "settings.vibrationDesc": "Kurzes Vibrieren bei Intervention",
    "settings.soundChoice": "Klang",
    "settings.faceTouchDesc": "Reagiert auf jede Berührung des Gesichts, nicht nur am Mund",
    "settings.officeTitle": "Office Mode",
    "settings.officeDot": "Status-Punkt anzeigen",
    "settings.officeDotDesc": "Kleiner Punkt zeigt den Erkennungszustand in der Tarnansicht",
    "settings.officeLayout": "Tarn-Layout",
    "settings.officeLayoutDesc": "Erscheinungsbild der neutralen Ansicht",
    "settings.officeSubtleDesc": "Interventionen erscheinen nur als kleine Notiz am Rand",
    "settings.dataTitle": "Daten",
    "settings.dataExport": "Exportieren",
    "settings.dataExportDesc": "Statistiken, Streak und Einstellungen als JSON-Datei sichern",
    "settings.dataImport": "Importieren",
    "settings.dataImportDesc": "Backup-Datei einlesen; vorhandene Daten werden ersetzt",

    "calibration.testWarning": "Mini-Reset testen",
    "presets.soft": "Sanft",
    "presets.normal": "Normal",
    "presets.precise": "Präzise",
    "calibration.sensitivity": "Sensitivität",
    "calibration.holdTime": "Haltezeit",
    "calibration.cooldown": "Cooldown",
    "calibration.faceTouch": "Gesichtsberührung melden",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Farbwarnung",
    "calibration.sound": "Ton",
    "calibration.vibration": "Vibration",
    "calibration.autoTune": "Automatisch anpassen",
    "calibration.autoTuneHint":
      "Nail Guard justiert Empfindlichkeit und Haltezeit anhand deiner Rückmeldungen (Treffer / Fehlalarm) nach.",
    "calibration.volume": "Lautstärke",
    "calibration.testSound": "Test",
    "calibration.recalibrate": "Kalibrierung neu starten",

    "sounds.softChime": "Sanfter Gong",
    "sounds.breathBell": "Atem-Glocke",
    "sounds.doubleTap": "Doppel-Klopfen",
    "sounds.bubblePop": "Bubble Pop",
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
    "neutral.exitTitle": "Office Mode beenden",
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

    "alert.title": "Kurz innehalten",
    "alert.body": "Atme einmal tief ein und wieder aus. Was war das gerade?",
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
    "errors.importFailed": "Die Backup-Datei konnte nicht importiert werden.",
    "errors.importFailedHint1":
      "Bitte eine unveränderte nailguard-backup-….json Datei aus dem Export verwenden.",
    "errors.generic": "Die App konnte nicht starten.",
    "errors.genericHint1": "Prüfe die Internetverbindung für den ersten MediaPipe-Download.",
    "errors.genericHint2": "Prüfe die Browser-Kamerafreigabe.",
    "errors.genericHint3": "Lade die Seite neu und versuche es erneut.",
  },

  en: {
    "app.title": "Nail Guard",
    "neutral.title": "Daily Board",

    "state.calm": "Calm",
    "state.calmHint": "Nail Guard runs quietly in the background — everything stays on your device",
    "state.warm": "Mindful",
    "state.warmHint": "Your hand is close to your face",
    "state.ember": "Hold on",
    "state.emberHint": "",
    "state.paused": "Paused",
    "state.pausedHint": "Monitoring is paused",

    "status.loadingModel": "Loading model …",
    "status.openingCamera": "Opening camera …",

    "aria.topbar": "App status",
    "aria.modeTabs": "App mode",
    "aria.proximity": "Proximity to mouth",
    "aria.presets": "Preset",
    "aria.languageToggle": "Language",
    "aria.hourBars": "Moments per hour",

    "start.title": "A calm coach for focused moments.",
    "start.body":
      "Start the camera, pick your mode and let Nail Guard run quietly in the background. No webcam images or videos are stored or uploaded.",
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

    "tabs.focus": "Focus",
    "tabs.calibration": "Settings",
    "tabs.review": "Review",

    "focus.openOffice": "Office Mode",
    "focus.pause": "Pause",
    "focus.resume": "Resume",
    "focus.quietTime": "Quiet time",
    "focus.momentsToday": "Moments today",

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

    "settings.title": "Settings",
    "settings.cameraTitle": "Camera",
    "settings.detectionTitle": "Detection",
    "settings.cuesTitle": "Cues",
    "settings.privacyTitle": "Privacy",
    "settings.privacyBody":
      "All processing happens entirely on your device. No image or video is ever stored or transmitted.",
    "settings.sensitivityDesc": "How close your hand may come to your mouth",
    "settings.holdDesc": "Time until an intervention",
    "settings.cooldownDesc": "Pause between two interventions",
    "settings.warmthDesc": "The ring warms up as your hand comes closer",
    "settings.overlayDesc": "Shows detected points in the camera image",
    "settings.soundDesc": "A quiet sound on intervention",
    "settings.vibrationDesc": "A short vibration on intervention",
    "settings.soundChoice": "Sound",
    "settings.faceTouchDesc": "Reacts to any touch of the face, not just near the mouth",
    "settings.officeTitle": "Office Mode",
    "settings.officeDot": "Show status dot",
    "settings.officeDotDesc": "A small dot shows the detection state in the disguised view",
    "settings.officeLayout": "Disguise layout",
    "settings.officeLayoutDesc": "Appearance of the neutral view",
    "settings.officeSubtleDesc": "Interventions appear only as a small note at the edge",
    "settings.dataTitle": "Data",
    "settings.dataExport": "Export",
    "settings.dataExportDesc": "Save statistics, streak and settings as a JSON file",
    "settings.dataImport": "Import",
    "settings.dataImportDesc": "Read a backup file; existing data will be replaced",

    "calibration.testWarning": "Test mini reset",
    "presets.soft": "Gentle",
    "presets.normal": "Normal",
    "presets.precise": "Precise",
    "calibration.sensitivity": "Sensitivity",
    "calibration.holdTime": "Hold time",
    "calibration.cooldown": "Cooldown",
    "calibration.faceTouch": "Report face touches",
    "calibration.overlay": "Overlay",
    "calibration.warmth": "Color cue",
    "calibration.sound": "Sound",
    "calibration.vibration": "Vibration",
    "calibration.autoTune": "Auto-adjust",
    "calibration.autoTuneHint":
      "Nail Guard fine-tunes sensitivity and hold time based on your feedback (hit / false alarm).",
    "calibration.volume": "Volume",
    "calibration.testSound": "Test",
    "calibration.recalibrate": "Restart calibration",

    "sounds.softChime": "Soft chime",
    "sounds.breathBell": "Breath bell",
    "sounds.doubleTap": "Double tap",
    "sounds.bubblePop": "Bubble pop",
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
    "neutral.exitTitle": "Exit Office Mode",
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

    "alert.title": "Hold on for a moment",
    "alert.body": "Take one deep breath in and out. What was that just now?",
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
    "errors.importFailed": "The backup file could not be imported.",
    "errors.importFailedHint1":
      "Please use an unmodified nailguard-backup-….json file from the export.",
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

  for (const el of root.querySelectorAll("[data-i18n-title]")) {
    el.setAttribute("title", t(el.dataset.i18nTitle));
  }
}
