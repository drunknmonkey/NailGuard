import Foundation

// Missing evidence is not confirmed withdrawal. Preserve the episode through
// occlusion, but release the screen after eight seconds of unknown tracking.
struct ProximityGate {
    var radius = 0.30
    var hold = 2.0
    private(set) var active = false
    private(set) var uncertain = false
    private(set) var episode = false
    private var nearSince: Double?
    private var awaySince: Double?
    private var missingSince: Double?
    private var lastSample: Double?

    mutating func reset() { self = ProximityGate(radius: radius, hold: hold) }
    mutating func update(distance: Double?, now: Double) -> Bool {
        if let previous = lastSample, now - previous > 1 {
            nearSince = nil; awaySince = nil
            if episode && missingSince == nil { missingSince = previous }
        }
        lastSample = now
        guard let distance = distance, distance.isFinite else {
            nearSince = nil; awaySince = nil
            if episode {
                if missingSince == nil { missingSince = now }
                uncertain = true
                if now - missingSince! >= 8 { active = false }
            }
            return false
        }
        missingSince = nil; uncertain = false
        if distance > radius * 1.35 {
            nearSince = nil
            if awaySince == nil { awaySince = now }
            if now - awaySince! >= 0.65 { active = false; episode = false }
            return false
        }
        awaySince = nil
        if episode { active = true; return false }
        // A sample in the hysteresis band cannot complete an approach.
        guard distance <= radius else { nearSince = nil; return false }
        if nearSince == nil { nearSince = now }
        guard now - nearSince! >= hold else { return false }
        active = true; episode = true
        return true
    }
}
