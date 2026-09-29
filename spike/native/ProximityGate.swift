import Foundation

// Ein Hinweis pro Annäherung. Er bleibt bis zur bestätigten Entfernung aktiv.
// Kurze Verdeckungen/Jitter lösen ihn nicht; verlorenes Tracking hält nie endlos.
struct ProximityGate {
    var radius = 0.30
    var hold = 2.0
    private(set) var active = false
    private var nearSince: Double?
    private var awaySince: Double?
    private var missingSince: Double?
    private var lastSample: Double?

    mutating func reset() {
        nearSince = nil; awaySince = nil; missingSince = nil
        lastSample = nil; active = false
    }
    mutating func update(distance: Double?, now: Double) -> Bool {
        if let previous = lastSample, now - previous > 0.5 { reset() }
        lastSample = now
        guard let distance = distance, distance.isFinite else {
            nearSince = nil
            if missingSince == nil { missingSince = now }
            if now - missingSince! >= 1.2 { active = false; awaySince = nil }
            return false
        }
        missingSince = nil
        if distance > radius * 1.2 {
            nearSince = nil
            if awaySince == nil { awaySince = now }
            if now - awaySince! >= 0.4 { active = false }
            return false
        }
        awaySince = nil
        if active { return false }
        if distance <= radius && nearSince == nil { nearSince = now }
        guard let since = nearSince, now - since >= hold else { return false }
        active = true
        return true
    }
}
