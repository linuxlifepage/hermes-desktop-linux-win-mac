import Foundation
import Testing
@testable import HermesDesktop

struct WorkspaceFileModelsTests {
    @Test
    func bookmarkUsesReadableTitleAndStableFileID() {
        let bookmark = WorkspaceFileBookmark(
            id: UUID(uuidString: "3C2E63A9-6A5B-4F10-8AF5-58434840904E")!,
            workspaceScopeFingerprint: "host|alice||~/.hermes",
            remotePath: "  ~/.hermes/memories/NOTES.md  "
        )

        #expect(bookmark.remotePath == "~/.hermes/memories/NOTES.md")
        #expect(bookmark.displayTitle == "NOTES.md")
        #expect(bookmark.fileID == "bookmark:3C2E63A9-6A5B-4F10-8AF5-58434840904E")
    }

    @Test
    func customBookmarkTitleIsTrimmedAndCanonicalFilesKeepPinnedIDs() {
        let bookmark = WorkspaceFileBookmark(
            workspaceScopeFingerprint: "host|alice||~/.hermes",
            remotePath: "/srv/hermes/context.md",
            title: "  Shared Context  "
        )
        let reference = WorkspaceFileReference.bookmark(bookmark)

        #expect(bookmark.displayTitle == "Shared Context")
        #expect(reference.id == bookmark.fileID)
        #expect(reference.remotePath == "/srv/hermes/context.md")
        #expect(RemoteTrackedFile.memory.workspaceFileID == "canonical:memory")
    }

    @Test
    func directoryEntryBlocksBookmarksAboveEditableLimit() {
        let entry = RemoteDirectoryEntry(
            name: "large.log",
            path: "/tmp/large.log",
            displayPath: "~/large.log",
            kind: .file,
            size: WorkspaceFileLimits.maxEditableFileBytes + 1,
            modifiedAt: nil,
            isReadable: true,
            isWritable: true,
            isSymlink: false
        )

        #expect(entry.isTooLargeToEdit)
        #expect(!entry.canBookmark)
    }
}
