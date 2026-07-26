import "@/components/videos/videos.css";

/**
 * Videos overview — STEP 1 of the two-step rebuild (s73 execution rules):
 * the pure port of docs/research/mock-sheets/Videos Overview.dc.html. The
 * sheet's own markup, its own classes, its own placeholder content — zero
 * wiring. This is the founder's structural verdict point; step 2 puts the
 * real project list behind these bands and deletes the old browser.
 *
 * The sheet's bands, top to bottom: the headline row (count pill · the
 * All/Published/In review/Drafts segmented control · Import media · + New
 * video) · the dashed bring-your-own import band · the three-column project
 * grid, each card a striped poster with its duration badge over a body of
 * title + state pill, the family line (versions · clips · platforms), and a
 * provenance/date footer · the new-project card · the closing record line.
 *
 * Thumbnails stay the sheet's striped PLACEHOLDER on purpose (founder s75:
 * "also have placeholder until bmedia ready") — the media join is B-media's,
 * and a poster frame derived from video is not built yet.
 */

interface FamilyPart {
  /** A door (dotted) in the sheet; a plain subtle span when there is nothing to open. */
  text: string;
  door: boolean;
}

interface VideoCard {
  poster: string;
  /** The sheet omits the badge entirely on a project with no assembled runtime. */
  duration: string | null;
  title: string;
  state: { text: string; className: string };
  family: FamilyPart[];
  provenance: string;
  when: string;
}

/** The sheet's own five fixture cards — placeholder content until step 2. */
const PROJECTS: VideoCard[] = [
  {
    poster: "poster · beat 04",
    duration: "0:42",
    title: "One-prompt launch film",
    state: { text: "in Approve", className: "pill pill-warn" },
    family: [
      { text: "2 versions", door: true },
      { text: "4 clips", door: true },
      { text: "3 platforms", door: true },
    ],
    provenance: "one-prompt · kling3 turbo",
    when: "today",
  },
  {
    poster: "composing · beat 4/8",
    duration: null,
    title: "Ship-notes explainer #3",
    state: { text: "composing", className: "pill pill-idle" },
    family: [
      { text: "1 version", door: true },
      { text: "clips follow the cut", door: false },
    ],
    provenance: "one-prompt · queued 14:20",
    when: "today",
  },
  {
    poster: "your master · frame 0:12",
    duration: "3:05",
    title: "Founder cut — conference talk",
    state: { text: "draft", className: "pill pill-idle" },
    family: [
      { text: "1 version", door: true },
      { text: "2 clips", door: true },
      { text: "no platforms yet", door: false },
    ],
    provenance: "imported by you",
    when: "Mon",
  },
  {
    poster: "poster · seasons tree",
    duration: "1:18",
    title: "Feature tour — staged chain",
    state: { text: "published", className: "pill pill-ok" },
    family: [
      { text: "3 versions", door: true },
      { text: "6 clips", door: true },
      { text: "4 platforms", door: true },
    ],
    provenance: "staged · 3-stage advanced",
    when: "18 Jul",
  },
  {
    poster: "meme frame",
    duration: "0:00",
    title: "Meme post — the horse",
    state: { text: "live on 3", className: "pill pill-ok" },
    family: [
      { text: "1 version", door: true },
      { text: "1 still", door: true },
      { text: "3 platforms", door: true },
    ],
    provenance: "image · approved 19 Jul",
    when: "22 Jul",
  },
];

/** The sheet's own filter vocabulary — placeholder content until step 2. */
const FILTERS = ["All", "Published", "In review", "Drafts"];

export function VideosOverview() {
  return (
    <div className="content videos-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Videos</h1>
        <span className="pill pill-idle">5 projects</span>
        <div className="seg">
          {FILTERS.map((filter) => (
            <span key={filter} className={filter === "All" ? "seg-opt on" : "seg-opt"}>
              {filter}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm">
          Import media
        </button>
        <button type="button" className="btn btn-primary btn-sm">
          + New video
        </button>
      </div>

      <div className="imp">
        <div className="imp-box">
          <strong>Bring your own.</strong> Drop a video, images or a music bed — or paste a URL.
          Your files join the media pool beside Thalon-made assets, provenance kept, ready for any
          cut.
        </div>
        <button type="button" className="btn btn-ghost">
          Browse files
        </button>
      </div>

      <div className="vgrid">
        {PROJECTS.map((project) => (
          <div key={project.title} className="vcard">
            <div className="thumb-lg">
              <span>{project.poster}</span>
              {project.duration && <span className="dur">{project.duration}</span>}
            </div>
            <div className="vbody">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="t-title" style={{ flex: 1 }}>
                  {project.title}
                </span>
                <span className={project.state.className}>{project.state.text}</span>
              </div>
              <div className="fam">
                {project.family.map((part, i) => (
                  <span key={part.text} style={{ display: "contents" }}>
                    {i > 0 && <span className="sep">·</span>}
                    <span className={part.door ? "fam-link" : "subtle"}>{part.text}</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span className="prov">{project.provenance}</span>
                <div style={{ flex: 1 }} />
                <span className="t-data">{project.when}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="newcard">
          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          <span className="t-label">One prompt → a full cut</span>
          <span className="prov">or start from an imported master</span>
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <span className="t-label">
          Derivatives never clutter this grid — every project folds its versions, clips and
          platform renders behind one card. Open a project for the full family.
        </span>
      </div>
    </div>
  );
}
