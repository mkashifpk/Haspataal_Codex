import { tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import * as notifications from "../generated/notifications";
import { Empty, ErrorBox, LoadState, Modal, useLoad } from "../components";
import { formatHospitalTime, hospitalTimeZoneError } from "../hospital-time";
import { definiteWriteRefusal } from "../write-attempt";
type Inbox = { items: notifications.NotificationOut[]; unread: number };

export function Notifications({
  revision,
  onRefresh,
  onRoute,
  timeZone,
}: {
  revision: number;
  onRefresh: () => void | Promise<void>;
  onRoute: (s: string) => void;
  timeZone?: string;
}) {
  const [unread, setUnread] = useState(false),
    [data, setData] = useState<Inbox>(),
    [readError, setReadError] = useState<unknown>(),
    [writeError, setWriteError] = useState<unknown>(),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [writing, setWriting] = useState(false),
    [hasOlder, setHasOlder] = useState(false),
    [confirmAll, setConfirmAll] = useState(false),
    [needsCheck, setNeedsCheck] = useState(false),
    [saved, setSaved] = useState(false);
  const flight = useRef(false),
    generation = useRef(0);
  const zoneProblem = hospitalTimeZoneError(timeZone);
  async function reload(explicit = false) {
    const current = ++generation.current;
    setLoading(true);
    setReadError(undefined);
    try {
      const [items, count] = await Promise.all([
        notifications.inbox({ unread_only: unread, limit: 50 }),
        notifications.unreadCount(),
      ]);
      if (current !== generation.current) return;
      setData({ items, unread: count.unread });
      setHasOlder(items.length === 50);
      if (explicit) {
        setNeedsCheck(false);
        setWriteError(undefined);
      }
      return true;
    } catch (cause) {
      if (current === generation.current) setReadError(cause);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [unread, revision]);
  async function run(id?: number) {
    if (flight.current || loading || needsCheck) return;
    flight.current = true;
    setBusy(true);
    setWriting(true);
    setConfirmAll(false);
    setWriteError(undefined);
    setSaved(false);
    let confirmed = false;
    try {
      // A read flag is not an approval/clinical acknowledgement. Never replay a
      // lost read-all automatically: newly arrived notices could now be included.
      if (id === undefined) await notifications.readAll();
      else await notifications.markRead(id);
      confirmed = true;
      setSaved(true);
      await reload(); // Keep confirmed outcome distinct from a failed follow-up read.
      await onRefresh();
    } catch (cause) {
      if (confirmed) setReadError(cause);
      else {
        setWriteError(cause);
        if (!definiteWriteRefusal(cause)) setNeedsCheck(true);
      }
    } finally {
      flight.current = false;
      setBusy(false);
      setWriting(false);
    }
  }
  async function older() {
    if (flight.current || loading || !data?.items.length) return;
    flight.current = true;
    setBusy(true);
    setReadError(undefined);
    const current = generation.current,
      base = data;
    try {
      const next = await notifications.inbox({
        unread_only: unread,
        before_id: base.items.at(-1)!.notification_id,
        limit: 50,
      });
      if (current !== generation.current) return;
      setData((previous) =>
        previous === base
          ? {
              ...base,
              items: [
                ...base.items,
                ...next.filter(
                  (n) =>
                    !base.items.some(
                      (old) => old.notification_id === n.notification_id,
                    ),
                ),
              ],
            }
          : previous,
      );
      setHasOlder(next.length === 50);
    } catch (cause) {
      if (current === generation.current) setReadError(cause);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const blocked = busy || loading || needsCheck;
  return (
    <div data-write-pending={writing}>
      <div className="section-heading">
        <div>
          <h1>{tr("Notifications")}</h1>
          <p className="muted">
            {tr("Updates and requests from your hospital.")}
          </p>
        </div>
        <div className="actions">
          <button
            data-help="notifications.refresh"
            disabled={busy || loading}
            onClick={async () => {
              if (await reload(true)) await onRefresh();
            }}
          >
            {tr("Refresh inbox")}
          </button>
          <button
            data-help="notifications.read"
            disabled={blocked || !data?.unread}
            onClick={() => setConfirmAll(true)}
          >
            {tr("Mark all as read")}
          </button>
        </div>
      </div>
      <p role="status">
        {tr("Unread notifications")}: {data?.unread ?? tr("Checking…")}
      </p>
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
      <ErrorBox error={writeError} />
      <ErrorBox error={zoneProblem} />
      <LoadState
        loading={loading}
        error={readError}
        retry={() => void reload(true)}
      />
      {saved && (
        <p className="notice" role="status">
          {tr(
            "Read status saved. A refresh error does not undo the saved change.",
          )}
        </p>
      )}
      {needsCheck && (
        <p className="notice" role="status">
          {tr(
            "The read-status result could not be confirmed. Refresh inbox before another action. No write is retried automatically; marking all again could include newer notifications.",
          )}
        </p>
      )}
      {!loading && data?.items.length === 0 && (
        <Empty>
          {tr(
            unread
              ? "No unread notifications."
              : "No notifications yet. New hospital updates will appear here.",
          )}
        </Empty>
      )}
      <div className="notification-list" aria-busy={loading}>
        {data?.items.map((n) => (
          <article
            className={"card notification " + (n.is_read ? "read" : "")}
            key={n.notification_id}
          >
            <span className="badge">{tr(n.severity)}</span>{" "}
            <span>{tr(n.is_read ? "Read" : "Unread")}</span>
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
                  disabled={blocked}
                  onClick={() => void run(n.notification_id)}
                >
                  {tr("Mark as read")}
                </button>
              )}
              {n.action_url && (
                <button
                  data-help="notifications.open"
                  disabled={writing}
                  onClick={() => onRoute(n.action_url!)}
                >
                  {tr("Open related item")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {hasOlder && !!data?.items.length && (
        <button
          data-help="notifications.filter"
          disabled={busy || loading}
          onClick={() => void older()}
        >
          {tr("Load older notifications")}
        </button>
      )}
      {confirmAll && (
        <Modal
          title={tr("Mark all notifications as read?")}
          onClose={() => !writing && setConfirmAll(false)}
        >
          <p>
            {tr(
              "This marks every current notification in your account as read, including older and filtered-out items. It does not approve requests, resolve alerts or record treatment.",
            )}
          </p>
          <p>
            {tr("Unread notifications")}: {data?.unread ?? tr("Checking…")}
          </p>
          <button
            data-help="notifications.read"
            onClick={() => setConfirmAll(false)}
          >
            {tr("Go back")}
          </button>
          <button
            data-help="notifications.read"
            disabled={blocked || !data?.unread}
            onClick={() => void run()}
          >
            {tr("Confirm mark all as read")}
          </button>
        </Modal>
      )}
    </div>
  );
}

// The event is a hint: it has title and identity but not the notification body.
// Never substitute an event's delivery priority for its notification severity.
export function CriticalNotificationToast({
  notice,
  onDismiss,
  onOpen,
}: {
  notice: { notification_id: number; title?: string };
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const r = useLoad(
    () =>
      notifications.inbox({
        limit: 200,
        before_id: notice.notification_id + 1,
      }),
    [notice.notification_id],
  );
  const record = r.data?.find(
    (n) => n.notification_id === notice.notification_id,
  );
  return (
    <aside className="notice critical-toast" role="alert">
      <strong>
        {record?.title || notice.title || tr("Critical notification")}
      </strong>
      {record ? (
        <p>{record.body}</p>
      ) : (
        !r.loading &&
        !r.error && (
          <p>
            {tr(
              "Open the inbox to find this notification. It may be outside the current view.",
            )}
          </p>
        )
      )}
      <LoadState {...r} retry={r.reload} />
      <button data-help="notifications.critical" onClick={onOpen}>
        {tr("Open notifications")}
      </button>
      <button data-help="notifications.critical" onClick={onDismiss}>
        {tr("Dismiss")}
      </button>
    </aside>
  );
}
