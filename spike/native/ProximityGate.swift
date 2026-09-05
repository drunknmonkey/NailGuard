import Foundation

// Native Testschwelle relativ zur Gesichtsbreite; keine Übernahme der
// MediaPipe-Kalibrierung, da die Landmark-Modelle nicht identisch sind.
struct ProximityGate {
    var radius = 0.30
    var hold = 2.0
    var cooldown = 15.0
    private var nearSince: Double?
    private var lastSample: Double?
    private var lastAlert = -Double.infinity
    private var latched = false

    mutating func reset() { nearSince = nil; lastSample = nil; latched = false }
    mutating func update(distance: Double?, now: Double) -> Bool {
        if let previous = lastSample, now - previous > 0.5 { reset() }
        lastSample = now
        guard let distance = distance, distance.isFinite, distance <= radius * 1.2 else {
            nearSince = nil; latched = false; return false
        }
        if distance <= radius && nearSince == nil { nearSince = now }
        guard let since = nearSince, !latched, now - since >= hold,
              now - lastAlert >= cooldown else { return false }
        latched = true; lastAlert = now
        return true
    }
}
