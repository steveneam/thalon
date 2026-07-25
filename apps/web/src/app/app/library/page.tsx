import { redirect } from "next/navigation";

/**
 * `/app/library` → `/app/transcription` (B-media.1, founder-directed s74).
 *
 * The surface was renamed; this route stays permanently so existing deep
 * links, bookmarks, the command palette's history and any pasted URL keep
 * working. A redirect is cheaper than a broken link and costs one file.
 */
export default function LibraryRedirect() {
  redirect("/app/transcription");
}
