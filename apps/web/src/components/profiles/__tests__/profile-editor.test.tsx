// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileEditor } from "@/components/profiles/profile-editor";

describe("ProfileEditor", () => {
  it("creates the first profile version, then saves a v2 with the version history visible", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);

    expect(await screen.findByText(/no versions yet/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Company"), "Thalon");
    await user.type(screen.getByLabelText("Topics"), "ai content automation");
    await user.type(screen.getByLabelText("Denylist"), "guarantee");
    await user.click(screen.getByRole("button", { name: /create profile/i }));

    expect(await screen.findByText(/saved as active version v1/i)).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();

    // Save again — a NEW version, never an in-place edit.
    await user.click(screen.getByRole("button", { name: /save as new active version/i }));
    expect(await screen.findByText(/saved as active version v2/i)).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("fails loud on malformed voice JSON without posting", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await screen.findByText(/no versions yet/i);

    await user.type(screen.getByLabelText("Voice JSON"), "{{nope");
    await user.click(screen.getByRole("button", { name: /create profile/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Voice/);
    expect(screen.queryByText(/saved as active version/i)).not.toBeInTheDocument();
  });
});
