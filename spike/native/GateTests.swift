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
        for i in 0...5 { _ = gate.update(distance: 0.9, now: 40.4 + Double(i)/10) }
        assert(!gate.active, "Bestätigte Entfernung beendet den Hinweis")
        for i in 0..<20 { assert(!gate.update(distance: 0.2, now: 41 + Double(i)/10)) }
        assert(gate.update(distance: 0.2, now: 43), "Neue Annäherung ohne künstliche 15s-Sperre")
        for i in 0...14 { _ = gate.update(distance: nil, now: 43.1 + Double(i)/10) }
        assert(!gate.active, "Dauerhaft fehlendes Tracking gibt den Bildschirm frei")
        gate.reset()
        assert(!gate.update(distance: 0.1, now: 100))
        assert(!gate.update(distance: 0.1, now: 110), "Schlaflücke erfüllt keine Haltezeit")
        assert(!gate.update(distance: 0.9, now: 110.1))
        for i in 0...21 { _ = gate.update(distance: 0.1, now: 120 + Double(i)/10) }
        assert(gate.active)
        gate.reset(); assert(!gate.active, "Pause/Stop gibt den Hinweis frei")
        print("Native proximity and camera choice tests: ok")
    }
}
