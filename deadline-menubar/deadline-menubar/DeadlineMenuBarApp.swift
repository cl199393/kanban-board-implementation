import SwiftUI

@main
struct DeadlineMenuBarApp: App {
    @StateObject private var store = DeadlineStore()

    var body: some Scene {
        MenuBarExtra {
            MenuBarView()
                .environmentObject(store)
                .onChange(of: store.deadlines) { newDeadlines in
                    NotificationScheduler.scheduleAll(deadlines: newDeadlines)
                }
        } label: {
            let emergencyCount = store.deadlines.filter(\.isEmergency).count
            let urgentCount    = store.deadlines.filter { $0.isUrgent && !$0.isEmergency }.count
            if emergencyCount > 0 {
                Label("\(emergencyCount)", systemImage: "exclamationmark.triangle.fill")
            } else if urgentCount > 0 {
                Label("\(urgentCount)", systemImage: "calendar.badge.exclamationmark")
            } else {
                Image(systemName: "calendar")
            }
        }
        .menuBarExtraStyle(.window)
    }

    init() {
        NotificationScheduler.requestPermission()
    }
}
