import Foundation
import SQLite3

/// Reads deadlines directly from the SQLite database on disk.
/// Link `libsqlite3.tbd` in Xcode: target → Build Phases → Link Binary With Libraries.
struct DatabaseReader {

    static let dbPath: String = {
        // Adjust this path if you move the deadline-sync directory
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return "\(home)/my-todo/deadline-sync/deadlines.db"
    }()

    static func fetchUpcoming(days: Int = 30) -> [Deadline] {
        var db: OpaquePointer?
        guard sqlite3_open_v2(dbPath, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else {
            print("DatabaseReader: cannot open \(dbPath)")
            return []
        }
        defer { sqlite3_close(db) }

        let sql = """
            SELECT id, source, source_id, title, course, due_at, url, notes,
                   dismissed, notified_1d, notified_1h, created_at, updated_at
            FROM deadlines
            WHERE dismissed = 0
              AND datetime(due_at) >= datetime('now')
              AND datetime(due_at) <= datetime('now', '\(days) days')
            ORDER BY due_at ASC
            """

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
        defer { sqlite3_finalize(stmt) }

        var results: [Deadline] = []

        while sqlite3_step(stmt) == SQLITE_ROW {
            func str(_ col: Int32) -> String {
                guard let ptr = sqlite3_column_text(stmt, col) else { return "" }
                return String(cString: ptr)
            }
            func optStr(_ col: Int32) -> String? {
                guard let ptr = sqlite3_column_text(stmt, col) else { return nil }
                let s = String(cString: ptr)
                return s.isEmpty ? nil : s
            }

            let deadline = Deadline(
                id:         str(0),
                source:     str(1),
                sourceId:   str(2),
                title:      str(3),
                course:     optStr(4),
                dueAt:      str(5),
                url:        optStr(6),
                notes:      optStr(7),
                dismissed:  Int(sqlite3_column_int(stmt, 8)),
                notified1d: Int(sqlite3_column_int(stmt, 9)),
                notified1h: Int(sqlite3_column_int(stmt, 10)),
                createdAt:  str(11),
                updatedAt:  str(12)
            )
            results.append(deadline)
        }

        return results
    }
}
