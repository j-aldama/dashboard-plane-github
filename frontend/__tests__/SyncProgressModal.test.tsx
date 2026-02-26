import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { SyncProgressModal, SyncStep } from "@/components/SyncProgressModal";
import { SYNC_STEPS } from "@/hooks/useSyncProgress";

/**
 * Helper: build a steps array where every step has the given status.
 */
function buildSteps(status: SyncStep["status"] = "pending"): SyncStep[] {
  return SYNC_STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    status,
  }));
}

describe("SyncProgressModal", () => {
  // --------------------------------------------------------------------- //
  // 1. Modal renders all steps with pending status
  // --------------------------------------------------------------------- //
  it("renders all steps with their labels when open", () => {
    const steps = buildSteps("pending");

    render(
      <SyncProgressModal
        isOpen={true}
        onClose={() => {}}
        steps={steps}
        overallProgress={0}
        isSyncing={true}
      />,
    );

    for (const step of SYNC_STEPS) {
      expect(screen.getByText(step.label)).toBeInTheDocument();
    }
  });

  // --------------------------------------------------------------------- //
  // 2. Close button only appears when not syncing
  // --------------------------------------------------------------------- //
  it("does not show the close button while syncing", () => {
    const steps = buildSteps("in_progress");

    render(
      <SyncProgressModal
        isOpen={true}
        onClose={() => {}}
        steps={steps}
        overallProgress={50}
        isSyncing={true}
      />,
    );

    // The header close button has aria-label "Cerrar modal".
    expect(screen.queryByLabelText("Cerrar modal")).not.toBeInTheDocument();
    // The footer "Cerrar" button text should also be absent.
    expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
  });

  it("shows the close button when syncing is finished", () => {
    const steps = buildSteps("completed");

    render(
      <SyncProgressModal
        isOpen={true}
        onClose={() => {}}
        steps={steps}
        overallProgress={100}
        isSyncing={false}
      />,
    );

    // Footer Cerrar button should be present.
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    // Header X button should also be present.
    expect(screen.getByLabelText("Cerrar modal")).toBeInTheDocument();
  });

  // --------------------------------------------------------------------- //
  // 3. Progress bar reflects the overallProgress value
  // --------------------------------------------------------------------- //
  it("sets the progress bar aria-valuenow to overallProgress", () => {
    const steps = buildSteps("in_progress");

    render(
      <SyncProgressModal
        isOpen={true}
        onClose={() => {}}
        steps={steps}
        overallProgress={45}
        isSyncing={true}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "45");
    // Also verify the percentage text is displayed.
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("clamps progress to 0-100 range", () => {
    const steps = buildSteps("completed");

    render(
      <SyncProgressModal
        isOpen={true}
        onClose={() => {}}
        steps={steps}
        overallProgress={150}
        isSyncing={false}
      />,
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "100");
  });

  // --------------------------------------------------------------------- //
  // 4. Modal does not render when isOpen is false
  // --------------------------------------------------------------------- //
  it("returns null when isOpen is false", () => {
    const steps = buildSteps("pending");

    const { container } = render(
      <SyncProgressModal
        isOpen={false}
        onClose={() => {}}
        steps={steps}
        overallProgress={0}
        isSyncing={false}
      />,
    );

    expect(container.innerHTML).toBe("");
  });
});
