import { Empty, LoadState, useLoad } from "../components";
import { receptionDashboard } from "../generated/queue_management";
import { tr } from "../i18n";
import type { DeskProps } from "./QueueManagement";
import {
  CashBackModal,
  DeskLoading,
  TicketLookup,
  TicketSummary,
  useTicketDesk,
} from "./TicketDesk";
export function CashBack({
  permissions,
  revision,
  readOnly,
  timeZone,
  currency,
  onShift,
}: DeskProps) {
  const desk = useTicketDesk(revision),
    hasQueue = permissions.includes("opd.queue.view");
  const dashboard = useLoad(
    () => (hasQueue ? receptionDashboard() : Promise.resolve(undefined)),
    [revision, hasQueue],
  );
  const locked = !!desk.record?.ticket.cash_back_prompts.length;
  return (
    <div>
      <div className="section-heading">
        <div>
          <h1>{tr("Mandatory cash-back")}</h1>
          <p>
            {tr(
              "Verify the patient, exact approved amount and your open cash drawer before handing back money.",
            )}
          </p>
        </div>
        <button
          data-help="cashback.refresh"
          onClick={() => {
            void desk.reload();
            void dashboard.reload();
          }}
        >
          {tr("Refresh cash-back")}
        </button>
      </div>
      <TicketLookup
        disabled={locked}
        onScan={(number) => void desk.scan(number)}
      />
      <DeskLoading desk={desk} />
      {desk.record && (
        <>
          <TicketSummary
            record={desk.record}
            timeZone={timeZone}
            currency={currency}
          />
          {!locked && (
            <p className="notice">
              {tr("No cash-back is pending for this slip.")}
            </p>
          )}
          <CashBackModal
            currency={currency}
            record={desk.record}
            permissions={permissions}
            readOnly={readOnly || desk.loading || !!desk.error}
            reload={desk.reload}
            onShift={onShift}
          />
        </>
      )}
      {hasQueue && (
        <section className="card">
          <h2>{tr("Cash-back waiting")}</h2>
          <LoadState {...dashboard} retry={dashboard.reload} />
          {dashboard.data?.cash_back_prompts.length === 0 && (
            <Empty>{tr("No cash-back waiting.")}</Empty>
          )}
          {dashboard.data?.cash_back_prompts.map((p) => (
            <p key={`${p.kind}:${p.id}`}>
              <bdi>
                {p.ticket_number} · {p.amount}
              </bdi>{" "}
              · {tr(p.kind)}{" "}
              <button
                data-help="cashback.open"
                disabled={locked}
                onClick={() => desk.select(p.ticket_id)}
              >
                {tr("Open slip")}
              </button>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
