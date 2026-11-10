"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import { cleanBill, STORAGE_KEY, type Bill } from "@/lib/meal";
import { decodeShareUrl, snapshotDigest } from "@/lib/sharing";
import {
  boundedJson,
  MAX_DRAFT_BYTES,
  parseDraft,
  readBill,
  record,
  serializeDraft,
} from "@/lib/validation";
export const SHARED_STORAGE_KEY = "family-meal-splitter-shared-v1";
interface Shared {
  original: Bill;
  digest: string;
  hash: string;
}
interface State {
  bill: Bill;
  ready: boolean;
  shared: Shared | null;
  revision: number;
  blocked: boolean;
  linkError: string;
  warning: string;
}
const initial: State = {
  bill: cleanBill(),
  ready: false,
  shared: null,
  revision: 0,
  blocked: false,
  linkError: "",
  warning: "",
};
export function useDinner() {
  const [state, setState] = useState<State>(initial);
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  const locationHref = useRef("");
  const loadTicket = useRef(0);
  const load = useCallback(async (href: string) => {
    const ticket = ++loadTicket.current;
    let next: State = { ...initial, ready: true };
    try {
      const incoming = decodeShareUrl(href);
      if (incoming) {
        const digest = await snapshotDigest(incoming.hash);
        next = {
          ...next,
          bill: incoming.bill,
          shared: { original: incoming.bill, digest, hash: incoming.hash },
        };
        try {
          const raw = localStorage.getItem(SHARED_STORAGE_KEY);
          if (raw !== null) {
            const saved = record(boundedJson(raw), ["snapshot", "bill"]);
            if (
              typeof saved.snapshot !== "string" ||
              !/^[a-f0-9]{64}$/.test(saved.snapshot)
            )
              throw new Error();
            const draft = readBill(saved.bill);
            if (saved.snapshot === digest) next.bill = draft;
          }
        } catch {
          next.blocked = true;
          next.warning =
            "The saved shared draft could not be restored. Existing data is preserved. You can edit in memory; use Reset to replace it deliberately.";
        }
      } else {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw !== null) next.bill = parseDraft(raw);
        } catch {
          next.blocked = true;
          next.warning =
            "Your saved dinner could not be restored. Existing data is preserved. You can edit in memory; use Reset to replace it deliberately.";
        }
      }
    } catch {
      next = {
        ...next,
        blocked: true,
        linkError:
          "This shared dinner link is invalid, unsupported, or too large. Your saved dinners are unchanged.",
      };
    }
    if (ticket === loadTicket.current) {
      locationHref.current = href;
      setState(next);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) void load(window.location.href);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  useEffect(() => {
    const handle = () => {
      if (locationHref.current === window.location.href) return;
      const active = current.current;
      const hasChanges =
        active.revision > 0 && !!(active.warning || active.blocked);
      if (
        hasChanges &&
        !window.confirm(
          "Your current edits could not be saved. Open the requested dinner and discard these in-memory edits?",
        )
      ) {
        window.history.replaceState(null, "", locationHref.current);
        return;
      }
      locationHref.current = window.location.href;
      setState((s) => ({ ...s, ready: false }));
      void load(window.location.href);
    };
    window.addEventListener("hashchange", handle);
    window.addEventListener("popstate", handle);
    return () => {
      window.removeEventListener("hashchange", handle);
      window.removeEventListener("popstate", handle);
    };
  }, [load]);
  useEffect(() => {
    if (!state.ready || !state.revision || state.blocked) return;
    try {
      const raw = serializeDraft(state.bill);
      const stored = state.shared
        ? JSON.stringify({
            snapshot: state.shared.digest,
            bill: JSON.parse(raw),
          })
        : raw;
      if (new TextEncoder().encode(stored).length > MAX_DRAFT_BYTES)
        throw new Error();
      localStorage.setItem(
        state.shared ? SHARED_STORAGE_KEY : STORAGE_KEY,
        stored,
      );
      queueMicrotask(() =>
        setState((s) => {
          if (
            s.blocked ||
            s.revision !== state.revision ||
            s.shared?.digest !== state.shared?.digest ||
            !s.warning
          )
            return s;
          return { ...s, warning: "" };
        }),
      );
    } catch {
      queueMicrotask(() =>
        setState((s) => {
          if (
            s.revision !== state.revision ||
            s.shared?.digest !== state.shared?.digest
          )
            return s;
          const warning =
            "Changes cannot be saved in this browser. Your last saved draft is preserved; keep this page open to edit and share.";
          return s.warning === warning ? s : { ...s, warning };
        }),
      );
    }
  }, [state.bill, state.ready, state.revision, state.blocked, state.shared]);
  const setBill = useCallback((action: SetStateAction<Bill>) => {
    setState((s) => {
      if (!s.ready) return s;
      const bill = typeof action === "function" ? action(s.bill) : action;
      if (JSON.stringify(bill) === JSON.stringify(s.bill)) return s;
      return { ...s, bill, revision: s.revision + 1 };
    });
  }, []);
  const replaceBill = useCallback(
    (bill: Bill) =>
      setState((s) => ({
        ...s,
        bill,
        revision: s.revision + 1,
        blocked: false,
        linkError: "",
        warning: "",
      })),
    [],
  );
  const reloadOriginal = useCallback(() => {
    setState((s) =>
      s.shared
        ? {
            ...s,
            bill: s.shared.original,
            revision: s.revision + 1,
            blocked: false,
            warning: "",
          }
        : s,
    );
  }, []);
  const openSaved = useCallback(() => {
    const active = current.current;
    if (
      active.revision > 0 &&
      (active.warning || active.blocked) &&
      !window.confirm(
        "Your current edits could not be saved. Open your saved dinner and discard these in-memory edits?",
      )
    )
      return;
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    window.history.pushState(null, "", url.href);
    void load(url.href);
  }, [load]);
  return {
    ...state,
    setBill,
    replaceBill,
    reloadOriginal,
    openSaved,
    locallyEdited:
      !!state.shared &&
      JSON.stringify(state.bill) !== JSON.stringify(state.shared.original),
  };
}
