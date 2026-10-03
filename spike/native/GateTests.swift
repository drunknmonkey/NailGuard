import Foundation
@main struct GateTests {
    static func main() {
        assert(CameraChoice.automaticID(ids: [], available: [], remembered: nil) == nil)
        assert(CameraChoice.automaticID(ids: ["internal"], available: ["internal"], remembered: nil) == "internal")
        assert(CameraChoice.automaticID(ids: ["internal"], available: [], remembered: "internal") == nil, "Ruhende interne Kamera nie starten")
        assert(CameraChoice.automaticID(ids: ["internal", "usb"], available: ["internal", "usb"], remembered: "internal") == nil, "Mehrere Kameras erfordern Bestätigung")
        assert(CameraChoice.automaticID(ids: ["internal", "usb"], available: ["usb"], remembered: "internal") == nil, "Zugeklappt mit Webcam: Auswahl zeigen")
        assert(CameraChoice.automaticID(ids: ["internal"], available: ["internal"], remembered: "usb") == nil, "Abgezogene Webcam erlaubt keinen stillen Wechsel")
        assert(CameraChoice.automaticID(ids: ["usb"], available: ["usb"], remembered: "usb") == "usb")
        var gate = ProximityGate()
        for i in 0..<20 { assert(!gate.update(distance: 0.2, now: Double(i)/10)) }
        assert(gate.update(distance: 0.2, now: 2))
        for i in 21...400 {
            assert(!gate.update(distance: 0.2, now: Double(i)/10))
            assert(gate.active, "Der Hinweis bleibt auch nach 40 Sekunden bestehen")
        }
        assert(!gate.update(distance: nil, now: 40.1)); assert(gate.active)
        assert(!gate.update(distance: 0.2, now: 40.3)); assert(gate.active)
        for i in 0...8 { _ = gate.update(distance: 0.9, now: 40.4 + Double(i)/10) }
        assert(!gate.active, "Bestätigte Entfernung beendet den Hinweis")
        for i in 0..<20 { assert(!gate.update(distance: 0.2, now: 41 + Double(i)/10)) }
        assert(gate.update(distance: 0.2, now: 43), "Neue Annäherung ohne künstliche 15s-Sperre")
        for i in 0...84 { _ = gate.update(distance: nil, now: 43.1 + Double(i)/10) }
        assert(!gate.active, "Dauerhaft fehlendes Tracking gibt den Bildschirm frei")
        assert(gate.uncertain)
        assert(!gate.update(distance: 0.1, now: 52), "Reacquisition is the same episode, not a new sound/moment")
        assert(gate.active)
        assert(!gate.update(distance: 0.1, now: 52.8)); assert(gate.active, "Slow frame does not clear the cue")
        _ = gate.update(distance: nil, now: 53)
        _ = gate.update(distance: nil, now: 55)
        assert(gate.active, "Two seconds of occlusion do not mean withdrawal")
        gate.reset()
        assert(!gate.update(distance: 0.1, now: 100))
        assert(!gate.update(distance: 0.1, now: 110), "Schlaflücke erfüllt keine Haltezeit")
        assert(!gate.update(distance: 0.9, now: 110.1))
        for i in 0...21 { _ = gate.update(distance: 0.1, now: 120 + Double(i)/10) }
        assert(gate.active)
        gate.reset(); assert(!gate.active, "Pause/Stop gibt den Hinweis frei")
        let suite = "tawel.tests." + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let review = ReviewStore(defaults: defaults)
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let day = ReviewStore.dayKey(date)
        for i in 0...100 { review.sample(now: Double(i)/10, date: date, valid: true, quiet: true, moment: false) }
        assert(abs(review.days[day]!.observedSeconds - 10) < 0.001)
        review.interrupt()
        review.sample(now: 100, date: date, valid: true, quiet: true, moment: false)
        assert(abs(review.days[day]!.observedSeconds - 10) < 0.001, "Pause is not observed time")
        review.sample(now: 100.1, date: date, valid: false, quiet: false, moment: false)
        review.sample(now: 100.2, date: date, valid: true, quiet: false, moment: true)
        review.save()
        let restored = ReviewStore(defaults: defaults)
        assert(restored.days[day]!.moments == 1)
        assert(restored.days[day]!.hourly.reduce(0,+) == 1)
        assert(abs(restored.days[day]!.longestQuietSeconds - 10) < 0.001)
        print("Native proximity and camera choice tests: ok")
    }
}
