import SwiftUI

// MARK: - Deadline model

struct Deadline: Identifiable, Codable {
    let id: String
    let source: String
    let sourceId: String
    let title: String
    let course: String?
    let dueAt: String        // ISO 8601 UTC
    let url: String?
    let notes: String?
    let dismissed: Int
    let notified1d: Int
    let notified1h: Int
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, source, title, course, url, notes, dismissed
        case sourceId    = "source_id"
        case dueAt       = "due_at"
        case notified1d  = "notified_1d"
        case notified1h  = "notified_1h"
        case createdAt   = "created_at"
        case updatedAt   = "updated_at"
    }

    var dueDate: Date? {
        ISO8601DateFormatter().date(from: dueAt)
    }

    var sourceColor: Color {
        switch source {
        case "canvas_gt":  return Color(hex: "#B3A369")
        case "canvas_ucf": return Color(hex: "#FFC904")
        case "microsoft":  return Color(hex: "#0078D4")
        case "gmail":      return Color(hex: "#EA4335")
        default:           return .gray
        }
    }

    var sourceLabel: String {
        switch source {
        case "canvas_gt":  return "GT Canvas"
        case "canvas_ucf": return "UCF Canvas"
        case "microsoft":  return "Microsoft"
        case "gmail":      return "Gmail"
        default:           return source
        }
    }

    var relativeTime: String {
        guard let due = dueDate else { return "Unknown" }
        let diff = due.timeIntervalSinceNow
        if diff < 0 { return "Overdue" }
        let days = Int(diff / 86400)
        let hours = Int(diff / 3600)
        let minutes = Int(diff / 60)
        if days >= 2 { return "\(days)d" }
        if days == 1 { return "1d" }
        if hours >= 1 { return "\(hours)h" }
        return "\(minutes)m"
    }

    var isUrgent: Bool {
        guard let due = dueDate else { return false }
        return due.timeIntervalSinceNow < 86400
    }

    /// Overdue or due within 3 hours
    var isEmergency: Bool {
        guard let due = dueDate else { return false }
        return due.timeIntervalSinceNow < 3 * 3600
    }
}

// MARK: - Color hex init

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let int = UInt64(hex, radix: 16) ?? 0
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
