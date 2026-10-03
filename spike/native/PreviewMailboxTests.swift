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
        assert(mailbox.read(enabled: true, now: 2.4) == "{}", "Expired image is not shown while new work is pending")
        let slow = mailbox.reserve(now: 2.4)!
        mailbox.complete(ticket: slow, frame: "late", sourceTime: 2.4, now: 3.2)
        assert(mailbox.read(enabled: true, now: 3.2) == "{}", "Encoder result must still represent a recent camera frame")
        let hidden = mailbox.reserve(now: 3.2)!
        mailbox.complete(ticket: hidden, frame: "hidden", sourceTime: 4.4, now: 4.4)
        assert(mailbox.reserve(now: 4.5) == nil, "Lease expires when window is hidden or timers stop")
        assert(mailbox.read(enabled: true, now: 4.5) == "{}")
        let resume = mailbox.reserve(now: 4.5)!
        mailbox.complete(ticket: resume, frame: "resumed", sourceTime: 4.5, now: 4.6)
        assert(mailbox.read(enabled: true, now: 4.6) == "resumed")
        assert(mailbox.read(enabled: false, now: 4.7) == "{}")
        assert(mailbox.reserve(now: 4.8) == nil, "Stopping preview does not implicitly restart it")
        print("Preview backpressure and page-switch tests: ok")
    }
}
