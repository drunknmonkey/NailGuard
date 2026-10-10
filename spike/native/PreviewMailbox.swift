import Foundation

// Camera analysis never waits for rendering. One leased, in-flight preview only.
final class PreviewMailbox {
    /// Preview cadence and size (0.1.30). The preview follows the camera frames
    /// (not the 15/s analysis), so it can run at up to 24 images/s; 640 px wide
    /// at a moderate JPEG quality is sharp enough for the settings pane without
    /// the encoder falling behind on a software context.
    static let minInterval = 1.0 / 24.0
    static let maxWidth: CGFloat = 640
    static let jpegQuality: Double = 0.72
    /// A finished image may be shown this long after its camera frame. A short
    /// stall (slow encode, a dropped frame) keeps the last image instead of
    /// flashing the waiting message; a real camera stop still clears it.
    static let holdSeconds = 2.0
    /// An encoder result older than this no longer represents the camera.
    static let staleResultSeconds = 0.75

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
        return now - frameAt < Self.holdSeconds ? frame : "{}"
    }
    func reserve(now: Double) -> UInt64? {
        lock.lock(); defer { lock.unlock() }
        guard now < until, !busy, now - lastStarted >= Self.minInterval else { return nil }
        busy = true; lastStarted = now
        return generation
    }
    func complete(ticket: UInt64, frame: String?, sourceTime: Double, now: Double) {
        lock.lock(); defer { lock.unlock() }
        busy = false
        guard ticket == generation, now < until, now - sourceTime < Self.staleResultSeconds, let frame = frame else { return }
        self.frame = frame; frameAt = sourceTime
    }
}
