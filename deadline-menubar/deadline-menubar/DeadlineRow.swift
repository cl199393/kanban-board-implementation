import SwiftUI

struct DeadlineRow: View {
    let deadline: Deadline
    @EnvironmentObject var store: DeadlineStore

    var body: some View {
        HStack(spacing: 10) {
            // Source badge
            Text(deadline.sourceLabel)
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(deadline.sourceColor)
                .cornerRadius(5)

            // Title + course
            VStack(alignment: .leading, spacing: 2) {
                Text(deadline.title)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(2)
                if let course = deadline.course {
                    Text(course)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            // Countdown
            Text(deadline.relativeTime)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(deadline.isUrgent ? .red : .secondary)

            // Dismiss button
            Button(action: { store.dismiss(id: deadline.id) }) {
                Image(systemName: "checkmark.circle")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 12)
    }
}
