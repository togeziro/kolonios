import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/icons";
import { ticketDetailQueryOptions } from "../api/queries";
import { useSubmitHandoffNote } from "../api/hooks";
import type { TicketLeg } from "../api/types";

export function legSubmittedFrom(legs: TicketLeg[]) {
  return legs.find((l) => l.status === "submitted") ?? null;
}

export default function HandoffConfirmation({
  ticketId,
}: {
  ticketId: number;
}) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery(ticketDetailQueryOptions(ticketId));
  const handoff = useSubmitHandoffNote();
  const [note, setNote] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center py-16 px-4">
        <Icons.spinner className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ticket = data?.ticket;
  if (!ticket) {
    return (
      <div className="space-y-4 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("ticket.invalidTicket")}
        </p>
        <Link to="/dashboard/my-work" className="text-xs font-semibold">
          {t("ticket.seeAll")}
        </Link>
      </div>
    );
  }

  const submitted = legSubmittedFrom(ticket.legs);
  const submittedIdx = submitted
    ? ticket.legs.findIndex((l) => l.id === submitted.id)
    : -1;
  const nextLeg =
    submittedIdx >= 0 ? (ticket.legs[submittedIdx + 1] ?? null) : null;

  return (
    <div className="space-y-4 p-4 pb-28">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
          <Icons.check className="h-8 w-8 text-green-500" />
        </div>
        <div>
          {ticket.ticketCode && (
            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              {ticket.ticketCode}
            </p>
          )}
          <h2 className="text-lg font-bold leading-tight dark:text-white">
            {submitted
              ? t("handoff.legSubmitted", { leg: submitted.legNumber })
              : t("handoff.submittedTitle")}
          </h2>
          <p className="text-muted-foreground text-xs">{ticket.title}</p>
        </div>
        <Badge className="rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-400">
          {t("handoff.awaitingPickup")}
        </Badge>
      </div>

      <Card className="space-y-2 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900">
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {t("handoff.nextStep")}
        </p>
        {nextLeg ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold dark:text-white">
                {t("handoff.nextLegName", {
                  leg: nextLeg.legNumber,
                  name: nextLeg.name,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {nextLeg.assigneeId
                  ? t("handoff.assignedToUser")
                  : t("handoff.poolFallback")}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {t("handoff.ready")}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("handoff.noNextLeg")}
          </p>
        )}
      </Card>

      <Card className="space-y-2 rounded-2xl border p-4 dark:border-zinc-800/50 dark:bg-zinc-900">
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {t("handoff.handoffNote")}
        </p>
        <Textarea
          value={note}
          placeholder={t("handoff.handoffNotePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          className="w-full"
          onClick={() => {
            if (!submitted || !note.trim()) return;
            handoff.mutate({ legId: submitted.id, note: note.trim() });
          }}
          disabled={handoff.isPending || !note.trim()}
        >
          {handoff.isPending ? (
            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Icons.check className="mr-2 h-4 w-4" />
          )}
          {t("handoff.saveHandoffNote")}
        </Button>
      </Card>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/95">
        <Link to="/dashboard/my-work">
          <Button variant="outline" className="w-full">
            {t("handoff.backToMyWork")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
