import Foundation

struct ReviewDay: Codable {
    var moments = 0
    var observedSeconds = 0.0
    var longestQuietSeconds = 0.0
    var hourly = Array(repeating: 0, count: 24)
}
// Capture-queue-owned store. Only aggregate counts/times, never camera data.
final class ReviewStore {
    private let defaults: UserDefaults
    private let key = "tawel.native.review.v1"
    private(set) var days: [String: ReviewDay]
    private var previous: (time: Double, day: String, quiet: Bool)?
    private var quietSeconds = 0.0
    private var lastSave = 0.0
    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        days = defaults.data(forKey: key).flatMap { try? JSONDecoder().decode([String: ReviewDay].self, from: $0) } ?? [:]
    }
    static func dayKey(_ date: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; f.timeZone = .current
        return f.string(from: date)
    }
    func sample(now: Double, date: Date, valid: Bool, quiet: Bool, moment: Bool) {
        let key = Self.dayKey(date)
        if moment {
            var day = days[key] ?? ReviewDay(); day.moments += 1
            day.hourly[Calendar.current.component(.hour, from: date)] += 1
            days[key] = day; quietSeconds = 0
        }
        if valid {
            var day = days[key] ?? ReviewDay()
            if let p = previous, p.day == key, now >= p.time, now - p.time <= 1 {
                let dt = now - p.time; day.observedSeconds += dt
                if quiet && p.quiet { quietSeconds += dt } else { quietSeconds = 0 }
            } else { quietSeconds = 0 }
            day.longestQuietSeconds = max(day.longestQuietSeconds, quietSeconds)
            days[key] = day; previous = (now, key, quiet)
        } else { previous = nil; quietSeconds = 0 }
        if moment || now - lastSave >= 5 { save(); lastSave = now }
    }
    func interrupt() { previous = nil; quietSeconds = 0; save() }
    func save() {
        if let data = try? JSONEncoder().encode(days) { defaults.set(data, forKey: key) }
    }
    func json() -> String {
        let today = Self.dayKey(Date())
        let yesterday = Self.dayKey(Calendar.current.date(byAdding: .day, value: -1, to: Date())!)
        struct Payload: Encodable { let today: String; let yesterday: String; let days: [String: ReviewDay] }
        guard let data = try? JSONEncoder().encode(Payload(today: today, yesterday: yesterday, days: days)) else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
