// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionToast } from "../action-toast";

describe("ActionToast (s40 terminal-action confirmation)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces politely, fires the link-back, and clears on both buttons", () => {
    const onClear = vi.fn();
    const linkBack = vi.fn();
    render(
      <ActionToast
        toast={{ message: "Dismissed 2 leads.", action: { label: "View dismissed", onClick: linkBack } }}
        onClear={onClear}
      />,
    );
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Dismissed 2 leads.");

    fireEvent.click(screen.getByRole("button", { name: "View dismissed" }));
    expect(linkBack).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it("auto-clears after 6s and renders nothing when there is no toast", () => {
    vi.useFakeTimers();
    const onClear = vi.fn();
    const { rerender } = render(<ActionToast toast={{ message: "Draft approved." }} onClear={onClear} />);
    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(onClear).toHaveBeenCalledOnce();

    rerender(<ActionToast toast={null} onClear={onClear} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
