import { VideoEditor } from "@/components/videos/editor";

/**
 * The video editor: the exact-mock rebuild of Videos.dc.html (DOCTRINE 0) —
 * the multi-track EDL surface with the agent as its front door. STEP 1 is
 * the sheet's own placeholder content; step 2 puts the real cut behind
 * these bands.
 */
export default function CutEditPage() {
  return <VideoEditor />;
}
