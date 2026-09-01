import { PageHero } from "@/components/page-hero";
import { PRIVACY_POLICY } from "@/lib/privacy-policy";
import type { WaiverBlock } from "@/lib/waiver-terms";

// Public (see proxy.ts's PUBLIC_PATHS) — reachable without a session both
// for genuine privacy-policy accessibility and because Health Connect's
// own permission sheet links out to this exact URL (android's strings.xml).
function PolicyBlock({ block }: { block: WaiverBlock }) {
  switch (block.type) {
    case "heading":
      return null; // PageHero already renders the page title
    case "subheading":
      return <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-card-light-foreground">{block.text}</h2>;
    case "paragraph":
      return <p className="mt-2 text-sm leading-relaxed text-card-light-muted">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-2 space-y-2">
          {block.items.map((item) => (
            <li key={item.title} className="text-sm leading-relaxed text-card-light-muted">
              <span className="font-semibold text-card-light-foreground">{item.title}</span>
              {item.body ? <span> — {item.body}</span> : null}
            </li>
          ))}
        </ul>
      );
  }
}

export default function PrivacyPolicyPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col pb-10">
      <PageHero title="Privacy Policy" subtitle="My Fit Pod" />
      <div className="flex-1 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md card-light p-6">
          {PRIVACY_POLICY.map((block, i) => (
            <PolicyBlock key={i} block={block} />
          ))}
        </div>
      </div>
    </main>
  );
}
