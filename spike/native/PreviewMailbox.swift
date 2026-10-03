import Foundation

// Camera analysis never waits for rendering. One leased, in-flight preview only.
final class PreviewMailbox {
    private let lock = NSLock()
    private var until = 0.0
    private var generation: UInt64 = 0
    private var busy = false
    private var lastStarted = -Double.infinity
    private var frameAt = 0.0
    private var frame = "{}"

    func read(enabled: Bool, now: Double) -> String {
        lock.lock(); defer { lock.unlock() }
        guard enabled else {
            generation &+= 1; until = 0; frame = "{}"; return "{}"
        }
        if now >= until { generation &+= 1; frame = "{}" }
        until = now + 1
        return now - frameAt < 0.75 ? frame : "{}"
    }
    func reserve(now: Double) -> UInt64? {
        lock.lock(); defer { lock.unlock() }
        guard now < until, !busy, now - lastStarted >= 0.1 else { return nil }
        busy = true; lastStarted = now
        return generation
    }
    func complete(ticket: UInt64, frame: String?, sourceTime: Double, now: Double) {
        lock.lock(); defer { lock.unlock() }
        busy = false
        guard ticket == generation, now < until, now - sourceTime < 0.75, let frame = frame else { return }
        self.frame = frame; frameAt = sourceTime
    }
}
