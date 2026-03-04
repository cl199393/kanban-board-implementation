import UserNotifications
import Foundation

private let kEmergencyNotifiedKey = "emergency_notified_ids"

struct NotificationScheduler {

    static func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    /// Fire immediate notifications for emergency deadlines not previously alerted.
    static func notifyEmergencyNow(deadlines: [Deadline]) {
        let center = UNUserNotificationCenter.current()
        var notifiedIds = Set(UserDefaults.standard.stringArray(forKey: kEmergencyNotifiedKey) ?? [])

        for d in deadlines where d.isEmergency {
            guard !notifiedIds.contains(d.id) else { continue }
            notifiedIds.insert(d.id)

            let content = UNMutableNotificationContent()
            let isOverdue = (d.dueDate?.timeIntervalSinceNow ?? 0) < 0
            content.title = isOverdue ? "🚨 Overdue: \(d.title)" : "🚨 Due in < 3 hours: \(d.title)"
            content.body  = d.course.map { "\($0) — \(d.relativeTime)" } ?? d.relativeTime
            content.sound = .defaultCritical

            let request = UNNotificationRequest(
                identifier: "emergency-\(d.id)",
                content: content,
                trigger: nil   // nil = deliver immediately
            )
            center.add(request) { error in
                if let error = error { print("Emergency notification error:", error) }
            }
        }

        UserDefaults.standard.set(Array(notifiedIds), forKey: kEmergencyNotifiedKey)
    }

    static func scheduleAll(deadlines: [Deadline]) {
        let center = UNUserNotificationCenter.current()
        // Remove old deadline notifications before rescheduling
        center.getPendingNotificationRequests { requests in
            let ids = requests.filter { $0.identifier.hasPrefix("deadline-") }.map(\.identifier)
            center.removePendingNotificationRequests(withIdentifiers: ids)

            let now = Date()
            for d in deadlines {
                guard let due = d.dueDate else { continue }

                // 1-day notification
                let minus1d = due.addingTimeInterval(-86400)
                if minus1d > now.addingTimeInterval(60) && d.notified1d == 0 {
                    schedule(
                        id: "deadline-1d-\(d.id)",
                        title: "Due Tomorrow: \(d.title)",
                        body: d.course.map { "\($0) — due in ~24 hours" } ?? "Due in ~24 hours",
                        at: minus1d
                    )
                }

                // 1-hour notification
                let minus1h = due.addingTimeInterval(-3600)
                if minus1h > now.addingTimeInterval(60) && d.notified1h == 0 {
                    schedule(
                        id: "deadline-1h-\(d.id)",
                        title: "Due Soon: \(d.title)",
                        body: d.course.map { "\($0) — due in ~1 hour" } ?? "Due in ~1 hour",
                        at: minus1h
                    )
                }
            }
        }
    }

    private static func schedule(id: String, title: String, body: String, at date: Date) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

        UNUserNotificationCenter.current().add(request) { error in
            if let error = error { print("Notification schedule error:", error) }
        }
    }
}
