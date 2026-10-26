import { useRef, useState, useEffect } from "react";
import { api } from "./bridge";
import { bilingual as t } from "./i18n";
import type { ClinicalUser } from "./clinical-context";
import type { ApprovalOut, CharityIn } from "./generated/charity_override";
import {
  writeAttempt,
  canRetryWrite,
  definiteWriteRefusal,
  type WriteAttempt,
} from "./write-attempt";
import {
  nonSecretCharityBody,
  charityPasswordProof,
  charityLockSeconds,
  type CharityBody,
} from "./charity-policy";
type Attempt = WriteAttempt<CharityBody> & {
  actor: number;
  salt?: string;
  proof?: string;
};
export function useCharityWrite(
  user: ClinicalUser,
  prescriptionId: number,
  onSaved: (row: ApprovalOut) => void,
) {
  const [attempt, setAttempt] = useState<Attempt>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(),
    [lockUntil, setLockUntil] = useState(0),
    [now, setNow] = useState(Date.now());
  const held = useRef<Attempt | undefined>(undefined),
    flight = useRef(false),
    current = useRef({ user, prescriptionId });
  current.current = { user, prescriptionId };
  const hold = (a: Attempt | undefined) => {
    held.current = a;
    setAttempt(a);
  };
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockUntil) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [lockUntil]);
  const remaining = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  async function send(
    a: Attempt,
    secret: string,
    prepare?: () => Promise<void>,
    retry = false,
  ) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setError(undefined);
    hold(a);
    let posted = false,
      confirmed = false;
    let payload: CharityIn | undefined;
    try {
      const c = current.current;
      if (
        c.user.user_id !== a.actor ||
        c.prescriptionId !== a.body.prescription_id ||
        !c.user.permissions.includes("pharmacy.dispense")
      )
        throw new Error(
          t(
            "The original actor, prescription or permission changed. Ask IT before another request.",
            "اصل صارف، نسخہ یا اجازت بدل گئی۔ دوسری درخواست سے پہلے آئی ٹی سے کہیں۔",
          ),
        );
      if (a.body.approver_username) {
        if (!secret)
          throw new Error(
            t(
              "The original co-signer must enter their password again.",
              "اصل شریک منظوری دینے والا پاس ورڈ دوبارہ درج کرے۔",
            ),
          );
        const digest = await charityPasswordProof(a.salt!, secret);
        if (retry && digest !== a.proof)
          throw new Error(
            t(
              "Re-enter the identical original co-signer password; the retained request cannot change.",
              "اصل شریک منظوری کا عین پاس ورڈ دوبارہ درج کریں؛ محفوظ درخواست بدل نہیں سکتی۔",
            ),
          );
        a.proof = digest;
      }
      if (prepare) await prepare();
      if (
        current.current.user.user_id !== a.actor ||
        current.current.prescriptionId !== a.body.prescription_id
      )
        throw new Error(
          t(
            "The context changed before submission.",
            "ارسال سے پہلے سیاق بدل گیا۔",
          ),
        );
      payload = {
        ...a.body,
        ...(a.body.approver_username ? { approver_password: secret } : {}),
      };
      posted = true;
      const result = await api<ApprovalOut>(
        "POST",
        "/pharmacy/charity-override-request",
        payload,
        { key: a.key },
      );
      confirmed = true;
      hold(undefined);
      onSaved(result);
    } catch (e) {
      setError(e);
      const seconds = charityLockSeconds(e);
      if (seconds) {
        setNow(Date.now());
        setLockUntil(Date.now() + seconds * 1000);
      }
      if (confirmed || (!retry && (!posted || definiteWriteRefusal(e))))
        hold(undefined);
    } finally {
      if (payload) delete payload.approver_password;
      secret = "";
      flight.current = false;
      setBusy(false);
    }
  }
  return {
    attempt,
    busy,
    error,
    remaining,
    blocked: busy || !!attempt,
    canRetry: !!attempt && canRetryWrite(attempt),
    start: (
      body: CharityBody,
      secret: string,
      prepare: () => Promise<void>,
    ) => {
      if (flight.current || held.current || remaining) return;
      const a: Attempt = {
        ...writeAttempt(nonSecretCharityBody(body)),
        actor: user.user_id,
        ...(body.approver_username ? { salt: crypto.randomUUID() } : {}),
      };
      void send(a, secret, prepare);
    },
    retry: (secret: string) => {
      const a = held.current;
      if (a && canRetryWrite(a) && !remaining)
        void send(a, secret, undefined, true);
    },
  };
}
