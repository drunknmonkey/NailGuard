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
        for i in 21...200 { assert(!gate.update(distance: 0.2, now: Double(i)/10)) }
        assert(!gate.update(distance: nil, now: 20.1))
        for i in 0..<20 { assert(!gate.update(distance: 0.2, now: 30 + Double(i)/10)) }
        assert(gate.update(distance: 0.2, now: 32))
        gate.reset()
        assert(!gate.update(distance: 0.1, now: 100))
        assert(!gate.update(distance: 0.1, now: 110), "Schlaflücke erfüllt keine Haltezeit")
        assert(!gate.update(distance: 0.9, now: 110.1))
        print("Native proximity tests: ok")
    }
}
