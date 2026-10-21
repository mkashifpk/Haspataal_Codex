import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import * as notifications from "../generated/notifications";
import { Empty, ErrorBox, LoadState, useLoad } from "../components";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";
export function Notifications({
  revision,
  onRefresh,
  onRoute,
  timeZone,
}: {
  revision: number;
  onRefresh: () => void;
  onRoute: (s: string) => void;
  timeZone?: string;
}) {
  const [unread, setUnread] = useState(false),
    [error, setError] = useState<unknown>(),
    [busy, setBusy] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const flight = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setHasOlder(true);
  }, [unread, revision]);
  const zoneProblem = hospitalTimeZoneError(timeZone);
  const r = useLoad(
    () => notifications.inbox({ unread_only: unread, limit: 50 }),
    [unread, revision],
  );
  async function run(fn: () => Promise<unknown>) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      await r.reload();
      onRefresh();
    } catch (e) {
      setError(e);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h1>{tr("Notifications")}</h1>
          <p className="muted">
            {tr("Updates and requests from your hospital.")}
          </p>
        </div>
        <button
          data-help="notifications.read"
          disabled={busy || !r.data?.some((n) => !n.is_read)}
          onClick={() => run(notifications.readAll)}
        >
          {tr("Mark all as read")}
        </button>
      </div>
      <label className="check">
        <input
          data-help="notifications.filter"
          type="checkbox"
          checked={unread}
          disabled={busy}
          onChange={(e) => setUnread(e.target.checked)}
        />
        {tr("Unread only")}
      </label>
      <ErrorBox error={error} />
      <ErrorBox error={zoneProblem} />
      <LoadState {...r} retry={r.reload} />
      {r.data?.length === 0 && <Empty>{tr("You’re all caught up.")}</Empty>}
      <div className="notification-list">
        {r.data?.map((n) => (
          <article
            className={"card notification " + (n.is_read ? "read" : "")}
            key={n.notification_id}
          >
            <span className="badge">{n.severity}</span>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            <small>
              {zoneProblem
                ? tr("Hospital timezone unavailable")
                : formatHospitalTime(n.created_at, timeZone!)}
            </small>
            <div className="actions">
              {!n.is_read && (
                <button
                  data-help="notifications.read"
                  disabled={busy}
                  onClick={() =>
                    run(() => notifications.markRead(n.notification_id))
                  }
                >
                  {tr("Mark as read")}
                </button>
              )}
              {n.action_url && (
                <button
                  data-help="notifications.open"
                  onClick={() => onRoute(n.action_url!)}
                >
                  {tr("Open related item")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {hasOlder && r.data && r.data.length >= 50 && (
        <button
          data-help="notifications.filter"
          disabled={busy}
          onClick={async () => {
            if (flight.current) return;
            flight.current = true;
            const currentGeneration = generation.current,
              baseRows = r.data!;
            setBusy(true);
            setError(undefined);
            try {
              const next = await notifications.inbox({
                unread_only: unread,
                before_id: r.data!.at(-1)!.notification_id,
                limit: 50,
              });
              if (generation.current === currentGeneration) {
                r.setData((previous) =>
                  previous === baseRows ? [...baseRows, ...next] : previous,
                );
                setHasOlder(next.length >= 50);
              }
            } catch (e) {
              setError(e);
            } finally {
              flight.current = false;
              setBusy(false);
            }
          }}
        >
          {tr("Load older notifications")}
        </button>
      )}
    </>
  );
}
