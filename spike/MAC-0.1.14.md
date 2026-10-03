# Mac-Alpha 0.1.14 · Unschärfe abstimmen

Auf Pauls Auftrag ein eigener Einstellungsbereich Animation: Unschärfe 0,5–10 px, Einblend- und Ausblendzeit jeweils 0,15–3 Sekunden. Lokale Speicherung und Zurücksetzen (2,7 px / 650 ms / 450 ms), automatische Vorschau nach Änderungen sowie Vorschauknopf. Nur Fokusverlust und Farbhauch → Fokusverlust verwenden diese Werte; Vorschau testet Fokusverlust, wenn ein anderer Hinweis gewählt ist. Die Hinweisart bleibt dabei unverändert.

Die Vorschau verwendet denselben Eintritt und Austritt wie ein gehaltener echter Hinweis, hält dazwischen 1,2 Sekunden. Kombination beginnt erst mit Farbe, danach Unschärfe. Native Ausblendfrist folgt den gewählten Zeiten, alte Fristen werden über Revisionen ungültig. Ein echter Treffer bleibt gehalten bis Handentfernung; Erkennung und Tracking-Grace unverändert. Bewegung reduzieren verkürzt Übergänge auf 150 ms.

0.1.13-Vorschauentkopplung und Laufzeitdiagnose bleiben enthalten, deren Wirkung auf Pauls Hardwarebefund ist weiterhin ungeprüft. Tests prüfen lokale Werte, Rücksetzen, durchgehende Vorschau mit gewähltem Austritt und gehaltene Hinweise; Layout um Animation ergänzt. Web-App unverändert, PR #33 Draft, kein Merge.
