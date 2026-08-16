// @vitest-environment jsdom
// i18n:skip
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n/config";
import HandoffConfirmation from "./handoff-confirmation";

const { detailMock, handoffMutate, handoffPending } = vi.hoisted(() => ({
  detailMock: vi.fn(),
  handoffMutate: vi.fn(),
  handoffPending: false,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: detailMock(), isLoading: false }),
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../api/hooks", () => ({
  useSubmitHandoffNote: () => ({
    mutate: handoffMutate,
    isPending: handoffPending,
  }),
}));

import { legSubmittedFrom } from "./handoff-confirmation";

describe("legSubmittedFrom", () => {
  it("returns the leg with submitted status", () => {
    const legs = [
      { id: 1, legNumber: 1, status: "completed" },
      { id: 2, legNumber: 2, status: "submitted" },
      { id: 3, legNumber: 3, status: "assigned" },
    ] as Parameters<typeof legSubmittedFrom>[0];
    expect(legSubmittedFrom(legs)?.id).toBe(2);
  });
});

describe("HandoffConfirmation", () => {
  it("renders submitted leg, awaiting pickup, and the next step", () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: {
        id: 7,
        ticketCode: "T-7",
        title: "Estafet",
        status: "in_progress",
        legs: [
          { id: 1, legNumber: 1, name: "Survey", status: "submitted" },
          {
            id: 2,
            legNumber: 2,
            name: "Install",
            status: "assigned",
            assigneeId: "u2",
          },
        ],
        worklog: [],
        materials: [],
        photos: [],
      },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <HandoffConfirmation ticketId={7} />
      </I18nextProvider>,
    );
    expect(screen.getByText(/Leg 1/i)).toBeTruthy();
    expect(screen.getByText(/awaiting/i)).toBeTruthy();
    expect(screen.getByText(/Install/)).toBeTruthy();
  });

  it("shows pool fallback when the next leg is unassigned", () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: {
        id: 7,
        ticketCode: "T-7",
        title: "Estafet",
        status: "in_progress",
        legs: [
          { id: 1, legNumber: 1, name: "Survey", status: "submitted" },
          {
            id: 2,
            legNumber: 2,
            name: "Extract",
            status: "open",
            assigneeId: null,
          },
        ],
        worklog: [],
        materials: [],
        photos: [],
      },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <HandoffConfirmation ticketId={7} />
      </I18nextProvider>,
    );
    expect(screen.getByText(/pool/i)).toBeTruthy();
  });

  it("submits the handoff note with the submitted leg id", () => {
    detailMock.mockReturnValue({
      success: true,
      ticket: {
        id: 7,
        ticketCode: "T-7",
        title: "Estafet",
        status: "in_progress",
        legs: [{ id: 5, legNumber: 1, name: "Survey", status: "submitted" }],
        worklog: [],
        materials: [],
        photos: [],
      },
    });
    render(
      <I18nextProvider i18n={i18n}>
        <HandoffConfirmation ticketId={7} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText(/next technician/), {
      target: { value: "Send courier" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(handoffMutate).toHaveBeenCalledWith({
      legId: 5,
      note: "Send courier",
    });
  });
});
