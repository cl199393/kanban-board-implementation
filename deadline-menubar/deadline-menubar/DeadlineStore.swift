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

    func dismiss(id: String) {
        // Optimistically remove from list
        deadlines.removeAll { $0.id == id }
        // Call API to persist
        guard let url = URL(string: "http://localhost:8765/deadlines/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)/dismiss") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        URLSession.shared.dataTask(with: req).resume()
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
