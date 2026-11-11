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
  parseDraft,
  readBill,
  record,
  serializeDraft,
} from "@/lib/validation";
import {
  appUrl,
  cloneBill,
  draftSelector,
  newSession,
  parseSession,
  sameBill,
  serializeSession,
  SESSION_STORAGE_KEY,
  SHARED_STORAGE_KEY,
  type LocalSession,
} from "@/lib/sessions";
export { SHARED_STORAGE_KEY } from "@/lib/sessions";
interface State {
  bill: Bill;
  ready: boolean;
  mode: "saved" | "snapshot" | "local" | "unavailable" | "invalid";
  shared: { original: Bill; hash: string } | null;
  session: LocalSession | null;
  legacy: Bill | null;
  revision: number;
  blocked: boolean;
  linkError: string;
  warning: string;
  actionWarning: string;
}
const initial: State = {
  bill: cleanBill(),
  ready: false,
  mode: "saved",
  shared: null,
  session: null,
  legacy: null,
  revision: 0,
  blocked: false,
  linkError: "",
  warning: "",
  actionWarning: "",
};
const writeWarning =
  "Changes cannot be saved in this browser. Your last saved dinner or local copy is preserved; keep this page open to edit and share. Leaving may lose these edits.";
const basePath = () => (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/";
export function useDinner() {
  const [state, setState] = useState<State>(initial);
  const current = useRef(state);
  useEffect(() => {
    current.current = state;
  }, [state]);
  const activeSession = useRef<LocalSession | null>(null);
  const locationHref = useRef("");
  const loadTicket = useRef(0);
  const load = useCallback(async (href: string) => {
    const ticket = ++loadTicket.current;
    let next: State = { ...initial, ready: true, bill: cleanBill() };
    try {
      const id = draftSelector(href);
      if (id) {
        next.mode = "unavailable";
        next.blocked = true;
        next.linkError = "This local copy is not available in this tab";
        try {
          const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
          const session = raw === null ? null : parseSession(raw);
          if (session?.id === id) {
            activeSession.current = session;
            next = {
              ...next,
              mode: "local",
              bill: cloneBill(session.current),
              session,
              blocked: false,
              linkError: "",
            };
          }
        } catch {
          /* Untrusted or unavailable storage never falls through to another dinner. */
        }
      } else {
        const incoming = decodeShareUrl(href);
        if (incoming) {
          next = {
            ...next,
            mode: "snapshot",
            bill: cloneBill(incoming.bill),
            shared: { original: cloneBill(incoming.bill), hash: incoming.hash },
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
              const prior = readBill(saved.bill);
              if (saved.snapshot === (await snapshotDigest(incoming.hash)))
                next.legacy = prior;
            }
          } catch {
            next.warning =
              "Previous shared edits could not be recovered. The original snapshot is shown and the older stored data is preserved.";
          }
        } else {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw !== null) next.bill = parseDraft(raw);
          } catch {
            next.blocked = true;
            next.warning =
              "Your saved dinner could not be restored. Existing data is preserved. You can edit in memory; use Reset saved dinner to replace it deliberately.";
          }
        }
      }
    } catch (e) {
      next = {
        ...next,
        mode: "invalid",
        blocked: true,
        linkError: (e as Error).message,
      };
    }
    if (ticket === loadTicket.current) {
      locationHref.current = href;
      setState(next);
    }
  }, []);
  useEffect(() => {
    void load(window.location.href);
  }, [load]);
  const canLeave = useCallback(() => {
    const s = current.current;
    return (
      !(s.revision && (s.warning || s.blocked)) ||
      window.confirm(
        "Your current edits could not be saved. Leave this dinner and discard these in-memory edits?",
      )
    );
  }, []);
  useEffect(() => {
    const handle = () => {
      if (locationHref.current === window.location.href) return;
      if (!canLeave()) {
        window.history.pushState(null, "", locationHref.current);
        return;
      }
      setState((s) => ({ ...s, ready: false }));
      void load(window.location.href);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const s = current.current;
      if (s.revision && (s.warning || s.blocked)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("hashchange", handle);
    window.addEventListener("popstate", handle);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("hashchange", handle);
      window.removeEventListener("popstate", handle);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [load, canLeave]);
  useEffect(() => {
    if (
      !state.ready ||
      !state.revision ||
      state.blocked ||
      (state.mode !== "saved" && state.mode !== "local")
    )
      return;
    let warning = "";
    try {
      if (state.session) {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          serializeSession(state.session),
        );
        activeSession.current = state.session;
      } else localStorage.setItem(STORAGE_KEY, serializeDraft(state.bill));
    } catch {
      warning = writeWarning;
    }
    queueMicrotask(() =>
      setState((s) =>
        s.revision === state.revision &&
        s.session?.id === state.session?.id &&
        s.mode === state.mode &&
        s.warning !== warning
          ? { ...s, warning }
          : s,
      ),
    );
  }, [
    state.bill,
    state.session,
    state.ready,
    state.revision,
    state.blocked,
    state.mode,
  ]);
  const setBill = useCallback((action: SetStateAction<Bill>) => {
    setState((s) => {
      if (!s.ready || (s.mode !== "saved" && s.mode !== "local")) return s;
      const bill = typeof action === "function" ? action(s.bill) : action;
      if (sameBill(bill, s.bill)) return s;
      const session = s.session ? { ...s.session, current: bill } : null;
      return { ...s, bill, session, revision: s.revision + 1 };
    });
  }, []);
  const replaceBill = useCallback(
    (bill: Bill) =>
      setState((s) => {
        if (s.mode !== "saved" && s.mode !== "local") return s;
        return {
          ...s,
          bill: cloneBill(bill),
          session: s.session
            ? { ...s.session, current: cloneBill(bill) }
            : null,
          revision: s.revision + 1,
          blocked: false,
          warning: "",
        };
      }),
    [],
  );
  const navigate = useCallback(
    (href: string) => {
      if (!canLeave()) return;
      window.history.pushState(null, "", href);
      void load(href);
      window.scrollTo({ top: 0 });
    },
    [load, canLeave],
  );
  const openSaved = useCallback(
    () => navigate(appUrl(window.location.origin, basePath())),
    [navigate],
  );
  const viewOriginal = useCallback(() => {
    const source = current.current.session?.source;
    if (source) {
      try {
        navigate(appUrl(window.location.origin, basePath(), { source }));
      } catch {
        setState((s) => ({
          ...s,
          actionWarning:
            "The original snapshot address is unavailable. Your local copy is unchanged.",
        }));
      }
    }
  }, [navigate]);
  const createLocal = useCallback(
    (kind: "copy" | "new" | "recover") => {
      const s = current.current;
      if (!s.ready || !canLeave()) return;
      let existing = activeSession.current;
      let unavailableRecord = false;
      try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (raw !== null) existing = parseSession(raw);
      } catch {
        unavailableRecord = true;
      }
      if (s.session) existing = s.session;
      if (
        (unavailableRecord ||
          (existing && !sameBill(existing.current, existing.baseline))) &&
        !window.confirm(
          unavailableRecord
            ? "The previous local copy could not be read. Creating a new copy may replace its stored record and discard any previous changes. Continue?"
            : "Replace the edited local copy in this tab? Its changes will be discarded. Use Share changes first to keep a portable link.",
        )
      )
        return;
      if (kind !== "new" && !s.shared) return;
      if (kind === "recover" && !s.legacy) return;
      let session: LocalSession;
      let href: string;
      try {
        session =
          kind === "new"
            ? newSession(cleanBill())
            : newSession(
                s.shared!.original,
                s.shared!.hash,
                kind === "recover" ? s.legacy! : s.shared!.original,
              );
        href = appUrl(window.location.origin, basePath(), { id: session.id });
        // Commit navigation before replacing bytes: history failures preserve the previous record.
        window.history.pushState(null, "", href);
      } catch {
        setState((current) => ({
          ...current,
          actionWarning:
            "This local copy could not be created. Your dinner and stored records are unchanged.",
        }));
        return;
      }
      let warning = "";
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, serializeSession(session));
      } catch {
        warning = writeWarning;
      }
      activeSession.current = session;
      ++loadTicket.current;
      locationHref.current = href;
      setState({
        ...initial,
        ready: true,
        mode: "local",
        bill: cloneBill(session.current),
        session,
        warning,
        revision: warning ? 1 : 0,
      });
      window.scrollTo({ top: 0 });
    },
    [canLeave],
  );
  const resetChanges = useCallback(() => {
    const session = current.current.session;
    if (session) replaceBill(session.baseline);
  }, [replaceBill]);
  return {
    ...state,
    setBill,
    replaceBill,
    openSaved,
    viewOriginal,
    resetChanges,
    createLocal,
    readOnly: state.mode !== "saved" && state.mode !== "local",
    locallyEdited:
      !!state.session && !sameBill(state.bill, state.session.baseline),
  };
}
