import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var store: DeadlineStore

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Text("Deadlines")
                    .font(.headline)
                Spacer()
                Button(action: { store.refresh() }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12))
                }
                .buttonStyle(.plain)
                .help("Refresh")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            if store.deadlines.isEmpty {
                Text("No upcoming deadlines")
                    .font(.system(size: 13))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 24)
            } else {
                let emergency = store.deadlines.filter(\.isEmergency)
                let normal    = store.deadlines.filter { !$0.isEmergency }

                ScrollView {
                    LazyVStack(spacing: 0) {
                        if !emergency.isEmpty {
                            HStack {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                    .font(.system(size: 11, weight: .bold))
                                Text("EMERGENCY")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.red)
                                Spacer()
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(Color.red.opacity(0.08))

                            ForEach(emergency) { deadline in
                                DeadlineRow(deadline: deadline)
                                    .background(Color.red.opacity(0.04))
                                Divider().padding(.leading, 12)
                            }

                            if !normal.isEmpty {
                                Divider()
                                    .padding(.vertical, 2)
                            }
                        }

                        ForEach(normal) { deadline in
                            DeadlineRow(deadline: deadline)
                            Divider().padding(.leading, 12)
                        }
                    }
                }
                .frame(maxHeight: 420)
            }

            Divider()

            HStack {
                Text("\(store.deadlines.count) upcoming")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                Spacer()
                Button("Quit") { NSApplication.shared.terminate(nil) }
                    .font(.system(size: 11))
                    .buttonStyle(.plain)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .frame(width: 360)
    }
}
