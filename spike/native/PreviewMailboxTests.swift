import Foundation

@main struct PreviewMailboxTests {
    static func main() {
        let mailbox = PreviewMailbox()
        assert(mailbox.reserve(now: 1) == nil, "No work before visible preview request")
        assert(mailbox.read(enabled: true, now: 1) == "{}")
        let first = mailbox.reserve(now: 1)!
        assert(mailbox.reserve(now: 1.3) == nil, "Slow encoder never accumulates a backlog")
        assert(mailbox.read(enabled: false, now: 1.4) == "{}", "Leaving camera does not wait for an encoder")
        _ = mailbox.read(enabled: true, now: 1.5)
        mailbox.complete(ticket: first, frame: "old", sourceTime: 1, now: 1.6)
        assert(mailbox.read(enabled: true, now: 1.6) == "{}", "Frame from previous camera page cannot reappear")
        let second = mailbox.reserve(now: 1.6)!
        mailbox.complete(ticket: second, frame: "current", sourceTime: 1.6, now: 1.7)
        assert(mailbox.read(enabled: true, now: 1.7) == "current")
        assert(mailbox.read(enabled: true, now: 2.4) == "current", "A short stall keeps the last image instead of flashing the waiting message")
        assert(mailbox.read(enabled: true, now: 3.3) == "current", "Still within the hold window")
        assert(mailbox.read(enabled: true, now: 3.65) == "{}", "A camera that really stopped clears the image after the hold window")
        let slow = mailbox.reserve(now: 3.65)!
        mailbox.complete(ticket: slow, frame: "late", sourceTime: 3.65, now: 4.45)
        assert(mailbox.read(enabled: true, now: 4.45) == "{}", "Encoder result must still represent a recent camera frame")
        let hidden = mailbox.reserve(now: 4.45)!
        mailbox.complete(ticket: hidden, frame: "hidden", sourceTime: 5.65, now: 5.65)
        assert(mailbox.reserve(now: 5.7) == nil, "Lease expires when window is hidden or timers stop")
        assert(mailbox.read(enabled: true, now: 5.7) == "{}")
        let resume = mailbox.reserve(now: 5.7)!
        mailbox.complete(ticket: resume, frame: "resumed", sourceTime: 5.7, now: 5.8)
        assert(mailbox.read(enabled: true, now: 5.8) == "resumed")
        // Cadence: the preview follows the camera at up to 24 images/s, never faster.
        let quick = mailbox.reserve(now: 5.8)!
        mailbox.complete(ticket: quick, frame: "quick", sourceTime: 5.8, now: 5.81)
        assert(mailbox.reserve(now: 5.82) == nil, "Next preview waits for the minimum interval")
        assert(mailbox.reserve(now: 5.8 + PreviewMailbox.minInterval) != nil, "Camera-paced preview resumes after the interval")
        assert(PreviewMailbox.minInterval <= 1.0 / 20.0 && PreviewMailbox.minInterval >= 1.0 / 30.0, "Preview cadence between 20 and 30 images/s")
        assert(PreviewMailbox.maxWidth >= 640 && PreviewMailbox.jpegQuality >= 0.7, "Preview is at least 640 px wide at a readable quality")
        assert(mailbox.read(enabled: false, now: 5.9) == "{}")
        assert(mailbox.reserve(now: 6.0) == nil, "Stopping preview does not implicitly restart it")
        print("Preview backpressure, hold window, cadence and page-switch tests: ok")
    }
}
