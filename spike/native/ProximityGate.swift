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
    private var candidateSince: Double?
    private var smoothedDistance: Double?
    private var lastFinite: Double?
    private var awaySince: Double?
    private var missingSince: Double?
    private var lastSample: Double?
    private var reacquireSince: Double?
    private var noHandSince: Double?
    var phase: Int {
        if active { return uncertain ? 4 : 3 }
        if episode { return 5 }
        if nearSince != nil { return 2 }
        return candidateSince == nil ? 0 : 1
    }

    mutating func reset() { self = ProximityGate(radius: radius, hold: hold) }
    private mutating func resetApproach() {
        nearSince = nil; candidateSince = nil; smoothedDistance = nil
    }
    mutating func update(distance: Double?, now: Double, handVisible: Bool? = nil) -> Bool {
        guard now.isFinite else { return false }
        if let previous = lastSample, now <= previous { return false }
        if !episode, let previous = lastSample, now - previous > 0.55 {
            resetApproach(); awaySince = nil
        }
        if let previous = lastSample, now - previous > 1 {
            resetApproach(); awaySince = nil
            if episode && missingSince == nil { missingSince = previous }
        }
        if let previous = lastSample, now - previous > 0.55 { reacquireSince = nil }
        // Expiry also applies when callbacks resume directly with a valid point.
        if episode, let previous = lastFinite, now - previous >= 8 { active = false }
        lastSample = now
        guard let distance = distance, distance.isFinite, distance >= 0 else {
            candidateSince = nil; awaySince = nil; reacquireSince = nil
            if handVisible == false {
                if noHandSince == nil { noHandSince = now }
                uncertain = false
                if now - noHandSince! >= 0.55 {
                    active = false; episode = false; missingSince = nil; resetApproach()
                }
                return false
            }
            noHandSince = nil
            if !episode, let previous = lastFinite, now - previous > 0.55 { resetApproach() }
            if episode {
                if missingSince == nil { missingSince = now }
                uncertain = true
                if now - missingSince! >= 8 { active = false }
            }
            return false
        }
        if !episode, let previous = lastFinite, now - previous > 0.55 { resetApproach() }
        lastFinite = now
        noHandSince = nil; missingSince = nil; uncertain = false
        // Keep the established episode/occlusion behaviour on raw measurements.
        // A smoothed tail must not delay confirmed withdrawal of an active cue.
        if distance >= radius * 1.35 {
            candidateSince = nil; reacquireSince = nil
            if awaySince == nil { awaySince = now }
            if now - awaySince! >= 0.65 {
                active = false; episode = false; resetApproach()
            }
            return false
        }
        awaySince = nil
        if episode {
            if !active {
                guard distance <= radius else { reacquireSince = nil; return false }
                if reacquireSince == nil { reacquireSince = now }
                guard now - reacquireSince! >= 0.65 else { return false }
                active = true; reacquireSince = nil
            }
            return false
        }
        smoothedDistance = smoothedDistance.map { $0 + 0.2 * (distance - $0) } ?? distance
        // Jitter preserves an established hold but cannot start/finish a hit.
        guard distance <= radius, smoothedDistance! <= radius else {
            candidateSince = nil; return false
        }
        if nearSince == nil {
            if candidateSince == nil { candidateSince = now }
            guard now - candidateSince! >= 0.35 else { return false }
            nearSince = now; candidateSince = nil
        }
        guard now - nearSince! >= hold else { return false }
        active = true; episode = true
        return true
    }
}
