// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsPanel } from "@/components/settings/settings-panel";

describe("SettingsPanel", () => {
  it("reads budget caps and the env-selected drivers as a read-only readout", async () => {
    render(<SettingsPanel />);

    expect(await screen.findByText("2,000,000")).toBeInTheDocument();
    expect(screen.getByText("hyperframes")).toBeInTheDocument();
    expect(screen.getByText("caption-file")).toBeInTheDocument();
    expect(screen.getByText("fake")).toBeInTheDocument();
    expect(screen.getByText("anthropic/claude-sonnet-4.5")).toBeInTheDocument();
    // Areas config points at Intel, where the config lives next to its output.
    expect(screen.getByRole("link", { name: /manage monitored areas/i })).toHaveAttribute(
      "href",
      "/app/intel",
    );
  });
});
