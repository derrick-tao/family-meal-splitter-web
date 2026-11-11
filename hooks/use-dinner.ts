"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { cleanBill, exampleBill, STORAGE_KEY, type Bill } from "@/lib/meal";
import { decodeShareUrl, snapshotDigest } from "@/lib/sharing";
import { boundedJson, parseDraft, readBill, record } from "@/lib/validation";
import {
  appUrl,
  cloneBill,
  draftSelector,
  parseSession,
  sameBill,
  SESSION_STORAGE_KEY,
  SHARED_STORAGE_KEY,
} from "@/lib/sessions";
import {
  hasWork,
  parseTabBill,
  serializeTabBill,
  TAB_BILL_KEY,
} from "@/lib/tab-bill";

export interface Recovery {
  id: "browser" | "tab" | "shared";
  label: string;
  bill: Bill;
}
interface State {
  work: Bill;
  shared: { bill: Bill; hash: string } | null;
  mode: "editor" | "snapshot" | "legacy" | "invalid";
  ready: boolean;
  blocked: boolean;
  saved: boolean;
  unsaved: boolean;
  warning: string;
  recoveryWarning: string;
  actionWarning: string;
  linkError: string;
  recoveries: Recovery[];
}
const initial: State = {
  work: cleanBill(),
  shared: null,
  mode: "editor",
  ready: false,
  blocked: false,
  saved: false,
  unsaved: false,
  warning: "",
  recoveryWarning: "",
  actionWarning: "",
  linkError: "",
  recoveries: [],
};
const saveWarning =
  "Changes are not saved in this tab. Keep this page open and use Share before refreshing or leaving. Your previously stored bill is preserved.";
const unreadableWarning =
  "Your previous bill could not be restored. Its stored data is preserved. Edits stay in memory; use New bill or Make a copy to replace it deliberately.";
const basePath = () => (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/";

export function useDinner() {
  const [state, setState] = useState<State>(initial);
  const current = useRef(state);
  const initialized = useRef(false);
  const locationHref = useRef("");
  const loadTicket = useRef(0);
  const publish = useCallback((next: State) => {
    current.current = next;
    setState(next);
  }, []);
  const loadView = useCallback(
    async (href: string) => {
      const ticket = ++loadTicket.current;
      // Claim the requested address before optional async recovery. Returning to a
      // previous address must invalidate this navigation even while it is pending.
      locationHref.current = href;
      let pendingShared: { digest: string; hash: string; bill: Bill } | null =
        null;
      const view: Pick<
        State,
        "shared" | "mode" | "linkError" | "recoveries" | "recoveryWarning"
      > = {
        shared: null,
        mode: "editor",
        linkError: "",
        recoveries: [],
        recoveryWarning: "",
      };
      try {
        const id = draftSelector(href);
        if (id) {
          view.mode = "legacy";
          view.linkError =
            "This older bill address is not available in this tab.";
          try {
            const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
            const old = raw === null ? null : parseSession(raw);
            if (old?.id === id) {
              view.linkError =
                "This is an older tab-only bill address. Recover its bill to continue editing.";
              view.recoveries.push({
                id: "tab",
                label: "Recover earlier tab bill",
                bill: cloneBill(old.current),
              });
            }
          } catch {
            /* Never reveal another bill for a mismatched or corrupt pointer. */
          }
        } else {
          const incoming = decodeShareUrl(href);
          if (incoming) {
            view.mode = "snapshot";
            view.shared = {
              bill: cloneBill(incoming.bill),
              hash: incoming.hash,
            };
          }
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw !== null)
              view.recoveries.push({
                id: "browser",
                label: "Recover earlier browser bill",
                bill: parseDraft(raw),
              });
          } catch {
            view.recoveryWarning =
              "An earlier browser bill could not be read. Its data is preserved.";
          }
          try {
            const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
            if (raw !== null)
              view.recoveries.push({
                id: "tab",
                label: "Recover earlier tab bill",
                bill: cloneBill(parseSession(raw).current),
              });
          } catch {
            view.recoveryWarning =
              "An earlier tab bill could not be read. Its data is preserved.";
          }
          if (incoming) {
            try {
              const raw = localStorage.getItem(SHARED_STORAGE_KEY);
              if (raw !== null) {
                const data = record(boundedJson(raw), ["snapshot", "bill"]);
                if (
                  typeof data.snapshot !== "string" ||
                  !/^[a-f0-9]{64}$/.test(data.snapshot)
                )
                  throw new Error();
                const bill = readBill(data.bill);
                pendingShared = {
                  digest: data.snapshot,
                  hash: incoming.hash,
                  bill,
                };
              }
            } catch {
              view.recoveryWarning =
                "Earlier shared edits could not be read. The original shared bill is shown and older data is preserved.";
            }
          }
        }
      } catch (error) {
        view.mode = "invalid";
        view.linkError = (error as Error).message;
        view.recoveries = [];
      }
      if (ticket !== loadTicket.current || window.location.href !== href)
        return;
      // Display and lock the URL's snapshot immediately. Legacy digest matching
      // enriches recovery options only; it must never delay the visible mode.
      publish({ ...current.current, ...view, ready: true, actionWarning: "" });
      if (!pendingShared) return;
      try {
        const digest = await snapshotDigest(pendingShared.hash);
        if (ticket !== loadTicket.current || window.location.href !== href)
          return;
        if (pendingShared.digest === digest)
          publish({
            ...current.current,
            recoveries: [
              ...current.current.recoveries,
              {
                id: "shared",
                label: "Recover earlier edits to this link",
                bill: pendingShared.bill,
              },
            ],
          });
      } catch {
        if (ticket !== loadTicket.current || window.location.href !== href)
          return;
        publish({
          ...current.current,
          recoveryWarning:
            "Earlier shared edits could not be read. The original shared bill is shown and older data is preserved.",
        });
      }
    },
    [publish],
  );

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const next = { ...current.current };
      try {
        const raw = sessionStorage.getItem(TAB_BILL_KEY);
        if (raw !== null) {
          next.work = parseTabBill(raw).bill;
          next.saved = true;
        }
      } catch {
        next.blocked = true;
        next.warning = unreadableWarning;
      }
      publish(next);
    }
    void loadView(window.location.href);
    const handle = () => {
      if (locationHref.current !== window.location.href)
        void loadView(window.location.href);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current.unsaved) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("popstate", handle);
    window.addEventListener("hashchange", handle);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("popstate", handle);
      window.removeEventListener("hashchange", handle);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [loadView, publish]);

  const persist = useCallback((bill: Bill, deliberate = false) => {
    const s = current.current;
    let saved = false,
      warning = "",
      blocked = s.blocked;
    if (blocked && !deliberate) warning = unreadableWarning;
    else {
      try {
        sessionStorage.setItem(TAB_BILL_KEY, serializeTabBill(bill));
        saved = true;
        blocked = false;
      } catch {
        warning = saveWarning;
      }
    }
    return { work: cloneBill(bill), saved, blocked, unsaved: !saved, warning };
  }, []);
  const setBill = useCallback(
    (action: SetStateAction<Bill>) => {
      const s = current.current;
      if (!s.ready || s.mode !== "editor") return;
      const bill = typeof action === "function" ? action(s.work) : action;
      if (sameBill(bill, s.work)) return;
      publish({ ...s, ...persist(bill), actionWarning: "" });
    },
    [persist, publish],
  );

  // No state or stored bytes are changed before a successful app-controlled navigation.
  const goEditor = useCallback((): string | null => {
    try {
      const href = appUrl(window.location.origin, basePath());
      if (window.location.href !== href)
        window.history.pushState(null, "", href);
      return href;
    } catch {
      publish({
        ...current.current,
        actionWarning:
          "This action could not open your bill. Your address, bill, and stored data are unchanged.",
      });
      return null;
    }
  }, [publish]);
  const continueBill = useCallback(() => {
    const href = goEditor();
    if (href) {
      void loadView(href);
      window.scrollTo({ top: 0 });
    }
  }, [goEditor, loadView]);
  const replaceWork = useCallback(
    (bill: Bill) => {
      const s = current.current;
      if (!s.ready) return false;
      let next: Bill;
      try {
        next = cloneBill(bill);
      } catch {
        publish({
          ...s,
          actionWarning:
            "This bill could not be opened. Your current work and stored data are unchanged.",
        });
        return false;
      }
      const href = goEditor();
      if (!href) return false;
      ++loadTicket.current;
      locationHref.current = href;
      publish({
        ...s,
        ...persist(next, true),
        mode: "editor",
        shared: null,
        ready: true,
        actionWarning: "",
        linkError: "",
      });
      void loadView(href);
      window.scrollTo({ top: 0 });
      return true;
    },
    [goEditor, loadView, persist, publish],
  );
  const newBill = useCallback(() => replaceWork(cleanBill()), [replaceWork]);
  const makeCopy = useCallback(() => {
    if (current.current.shared) replaceWork(current.current.shared.bill);
  }, [replaceWork]);
  const loadExample = useCallback(() => {
    if (current.current.mode === "editor") replaceWork(exampleBill());
  }, [replaceWork]);
  const recover = useCallback(
    (id: Recovery["id"]) => {
      const source = current.current.recoveries.find((r) => r.id === id);
      if (source) replaceWork(source.bill);
    },
    [replaceWork],
  );

  return {
    ...state,
    bill:
      state.shared?.bill ??
      (state.mode === "editor" ? state.work : cleanBill()),
    readOnly: state.mode !== "editor",
    hasCurrentBill: hasWork(state.work),
    requiresReplacement: state.blocked || hasWork(state.work),
    setBill,
    newBill,
    makeCopy,
    loadExample,
    recover,
    continueBill,
  };
}
