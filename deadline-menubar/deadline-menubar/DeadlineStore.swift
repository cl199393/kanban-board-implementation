import Foundation
import Combine

@MainActor
final class DeadlineStore: ObservableObject {
    @Published var deadlines: [Deadline] = []

    private var timer: Timer?

    init() {
        refresh()
        startTimer()
    }

    func refresh() {
        Task.detached(priority: .background) { [weak self] in
            let fetched = DatabaseReader.fetchUpcoming(days: 30)
            await MainActor.run { self?.deadlines = fetched }
            NotificationScheduler.notifyEmergencyNow(deadlines: fetched)
        }
    }

    private func startTimer() {
        // Refresh every 2 minutes
        timer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.refresh()
            }
        }
        RunLoop.main.add(timer!, forMode: .common)
    }

    deinit {
        timer?.invalidate()
    }
}
