"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Heart,
  House,
  Info,
  Leaf,
  MessageCircle,
  Plus,
  Pencil,
  ShieldCheck,
  Sparkles,
  Share2,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/dialog";
import { useDinner, type Recovery } from "@/hooks/use-dinner";
import { createShareUrl, type NamePrivacy } from "@/lib/sharing";
import { isSafeText } from "@/lib/validation";
import {
  allocate,
  ageDefault,
  childName,
  generateMessage,
  householdName,
  householdWeight,
  billTitle,
  DEFAULT_TITLE,
  money,
  parseCents,
  resetChild,
  updateChild,
  type Child,
  type Household,
  type Allocation,
} from "@/lib/meal";
const colors = ["teal", "coral", "gold", "purple"];
export default function MealSplitter() {
  const {
    bill,
    setBill,
    ready,
    shared,
    warning: storageWarning,
    actionWarning,
    blocked,
    linkError,
    readOnly,
    saved,
    recoveryWarning,
    recoveries,
    requiresReplacement,
    hasCurrentBill,
    newBill,
    makeCopy,
    loadExample,
    recover,
    continueBill,
  } = useDinner();
  const [notice, setNotice] = useState("");
  type Action = "new" | "copy" | "example" | Recovery["id"];
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [sharing, setSharing] = useState(false);
  const [privacy, setPrivacy] = useState<NamePrivacy>("initials");
  const [shareLink, setShareLink] = useState("");
  const [shareError, setShareError] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const entry = !readOnly && !linkError && bill.households.length === 0;
  const [titleOpen, setTitleOpen] = useState(false);
  const titleExpanded = titleOpen || bill.title !== DEFAULT_TITLE;
  const titleRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<string | null>(null);
  const previousEntry = useRef(entry);
  useEffect(() => {
    if (entry && !previousEntry.current) setTitleOpen(false);
    previousEntry.current = entry;
    const target = focusTarget.current;
    if (!target) return;
    const node =
      target === "entry" ? addRef.current : document.getElementById(target);
    if (node) {
      node.focus();
      node.scrollIntoView({ block: "nearest" });
      focusTarget.current = null;
    }
  }, [bill.households, entry]);
  const cents = parseCents(bill.amount);
  let rows: Allocation[] = [];
  let error = "";
  try {
    if (cents !== null) rows = allocate(cents, bill.households);
    else
      error =
        "Enter a positive dollar amount or zero, with up to two decimal places.";
  } catch (e) {
    error = (e as Error).message;
  }
  const totalWeight = bill.households.reduce(
    (sum, h) => sum + householdWeight(h),
    0,
  );
  const people = bill.households.reduce(
    (sum, h) => sum + h.adults + h.children.length,
    0,
  );
  const message = generateMessage(bill, rows);
  const messageInputsSafe =
    isSafeText(bill.title, 120) &&
    bill.households.every(
      (h) =>
        isSafeText(h.name, 1048576) &&
        h.children.every((c) => isSafeText(c.name, 1048576)),
    );
  function patchHouse(id: string, patch: Partial<Household>) {
    setBill((b) => ({
      ...b,
      households: b.households.map((h) =>
        h.id === id ? { ...h, ...patch } : h,
      ),
    }));
  }
  function patchChild(
    hid: string,
    cid: string,
    patch: Partial<Child>,
    reset = false,
  ) {
    setBill((b) => ({
      ...b,
      households: b.households.map((h) =>
        h.id === hid
          ? {
              ...h,
              children: h.children.map((c) =>
                c.id === cid
                  ? reset
                    ? resetChild(c)
                    : updateChild(c, patch)
                  : c,
              ),
            }
          : h,
      ),
    }));
  }
  function addHouse() {
    const id = crypto.randomUUID();
    focusTarget.current = `household-${id}`;
    setBill((b) => ({
      ...b,
      households: [...b.households, { id, name: "", adults: 1, children: [] }],
    }));
  }
  function addChild(id: string) {
    setBill((b) => ({
      ...b,
      households: b.households.map((h) =>
        h.id === id
          ? {
              ...h,
              children: [
                ...h.children,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  age: null,
                  percentage: 0,
                  overridden: false,
                },
              ],
            }
          : h,
      ),
    }));
  }
  async function copy() {
    if (!messageInputsSafe) {
      setNotice("Remove unsupported control characters before copying.");
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Message copied! Ready for the group chat.");
    } catch {
      setNotice(
        "Copy unavailable. Select the message text and copy it manually.",
      );
    }
  }
  function performAction(action: Action) {
    if (action === "new") {
      if (newBill()) setTitleOpen(false);
    } else if (action === "copy") makeCopy();
    else if (action === "example") loadExample();
    else recover(action);
    setNotice("");
  }
  function requestAction(action: Action) {
    if (!ready || (action === "example" && readOnly)) return;
    if (requiresReplacement) setConfirm(action);
    else performAction(action);
  }
  async function copyShare() {
    setShareError("");
    try {
      const base = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/";
      const url = createShareUrl(bill, privacy, window.location.origin, base);
      setShareLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setNotice("Share link copied! This link contains a fixed snapshot.");
      } catch {
        setShareError(
          "Copy unavailable. Select the link below and copy it manually.",
        );
      }
    } catch (e) {
      setShareError((e as Error).message);
      setShareLink("");
    }
  }
  function openShare() {
    setPrivacy("initials");
    setShareLink("");
    setShareError("");
    setSharing(true);
  }
  const safeInput = (value: string, max = 1048576) => isSafeText(value, max);
  return (
    <>
      <header className={`site-header ${entry ? "entry-header" : ""}`}>
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              continueBill();
            }}
          >
            <span className="brand-icon">
              <Utensils size={22} />
            </span>
            <span>
              family meal<span className="brand-light"> splitter</span>
            </span>
          </a>
          <div className="header-note">
            <span className="status-dot" /> Good food. Fair shares.
          </div>
          <span className="header-heart">
            <Heart size={16} /> Made for togetherness
          </span>
        </div>
      </header>
      <main className={entry ? "entry-main" : undefined}>
        {!entry && (
          <section className="hero">
            <div className="eyebrow">
              <span /> LESS MATH, MORE MEMORIES
            </div>
            <h1>
              One table. <span>Everyone’s fair share.</span>
            </h1>
            <p>Split the bill fairly, even with little eaters!</p>
            <div className="hero-bottom">
              <span>
                Big appetites or little bites. There’s room for everyone.
              </span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  onClick={() => requestAction("example")}
                >
                  <Sparkles size={15} /> Load Example Dinner{" "}
                  <ArrowUpRight size={14} />
                </Button>
              )}
            </div>
            <div className="hero-doodle" aria-hidden="true">
              🍽️<span>♡</span>
            </div>
          </section>
        )}
        {entry && (
          <section className="entry-intro">
            {/* A same-origin decorative photograph; never part of the reading order. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="entry-plate"
              src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dinner-plate.webp`}
              alt=""
              width="540"
              height="680"
            />
            <h1>
              Let’s split
              <br />
              <span>dinner.</span>
            </h1>
            <p>
              Start with the total. We’ll take
              <br className="entry-copy-break" /> it from there.
            </p>
          </section>
        )}
        {storageWarning && (
          <p role="status" className="warning">
            {entry
              ? blocked
                ? "Your previous bill could not be restored. Its stored data is preserved. Edits stay in memory and may be lost on refresh or leaving. Use New bill to replace it deliberately."
                : "Changes are not saved in this tab. Keep this page open; refreshing or leaving may lose edits. Your previously stored bill is preserved."
              : storageWarning}
          </p>
        )}
        {actionWarning && (
          <p role="status" className="warning">
            {actionWarning}
          </p>
        )}
        {linkError && (
          <div className="warning" role="alert">
            <p>{linkError}</p>
            <Button variant="outline" onClick={continueBill}>
              Continue my bill
            </Button>
            <Button onClick={() => requestAction("new")}>New bill</Button>
          </div>
        )}
        {!entry && !linkError && ready && (
          <section
            className={`shared-banner ${shared ? "" : "bill-status"}`}
            aria-label="Bill status"
          >
            <div>
              {shared ? (
                <>
                  <strong>Shared bill · read-only</strong>
                  <p>
                    This link keeps its original values. Make a copy to edit.
                  </p>
                </>
              ) : (
                <p>
                  {saved
                    ? "Saved in this tab."
                    : storageWarning
                      ? "Not saved in this tab."
                      : "Changes save in this tab."}{" "}
                  Use Share to keep a link for later.
                </p>
              )}
            </div>
            <div className="shared-actions">
              {shared && (
                <Button size="sm" onClick={() => requestAction("copy")}>
                  Make a copy
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestAction("new")}
              >
                New bill
              </Button>
              {shared && hasCurrentBill && (
                <Button variant="ghost" size="sm" onClick={continueBill}>
                  Continue my bill
                </Button>
              )}
            </div>
          </section>
        )}
        {entry && (
          <fieldset className="entry-fields editor-fields" disabled={!ready}>
            <section aria-labelledby="entry-total-heading">
              <div className="entry-total-heading">
                <h2 id="entry-total-heading">
                  <label htmlFor="bill-amount">Dinner total</label>
                </h2>
                {requiresReplacement && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestAction("new")}
                  >
                    New bill
                  </Button>
                )}
              </div>
              <div
                className={`currency-input entry-amount ${cents === null ? "invalid" : ""}`}
              >
                <span aria-hidden="true">$</span>
                <Input
                  id="bill-amount"
                  inputMode="decimal"
                  value={bill.amount}
                  onChange={(e) => {
                    if (safeInput(e.target.value, 128))
                      setBill({ ...bill, amount: e.target.value });
                  }}
                  onBlur={() => {
                    if (cents !== null)
                      setBill((b) => ({
                        ...b,
                        amount: (cents / 100).toFixed(2),
                      }));
                  }}
                  aria-invalid={cents === null}
                  aria-describedby={
                    cents === null
                      ? "bill-help entry-amount-error"
                      : "bill-help"
                  }
                />
                <span className="currency-code">USD</span>
              </div>
              <p id="bill-help" className="entry-helper">
                Include tax and tip.
              </p>
              {cents === null && (
                <p
                  id="entry-amount-error"
                  className="warning entry-validation"
                  role="alert"
                >
                  Enter a positive dollar amount or zero, with up to two decimal
                  places.
                </p>
              )}
              <div className="entry-title">
                <Button
                  variant="ghost"
                  className="entry-title-toggle"
                  aria-expanded={titleExpanded}
                  aria-controls="entry-title-field"
                  onClick={() => {
                    setTitleOpen(true);
                    requestAnimationFrame(() => titleRef.current?.focus());
                  }}
                >
                  <Pencil size={18} />{" "}
                  {titleExpanded ? "Dinner name" : "Add a dinner name"}
                </Button>
                <div id="entry-title-field" hidden={!titleExpanded}>
                  <label htmlFor="dinner-title" className="field-label">
                    Dinner title
                  </label>
                  <Input
                    ref={titleRef}
                    onFocus={() => setTitleOpen(true)}
                    id="dinner-title"
                    className="dinner-title-input"
                    value={bill.title}
                    placeholder={DEFAULT_TITLE}
                    onChange={(e) => {
                      if (safeInput(e.target.value, 120))
                        setBill({ ...bill, title: e.target.value });
                    }}
                    aria-describedby="title-help"
                  />
                  <p id="title-help" className="helper">
                    Shown in your split, message, and shared dinner. Up to 120
                    characters.
                  </p>
                </div>
              </div>
            </section>
            <section
              className="entry-joining"
              aria-labelledby="joining-heading"
            >
              <h2 id="joining-heading">Who’s joining?</h2>
              <p>Add the households at your table.</p>
              <Button ref={addRef} className="entry-add" onClick={addHouse}>
                <Plus size={24} /> Add a household
              </Button>
              <Button
                variant="ghost"
                className="entry-example"
                onClick={() => requestAction("example")}
              >
                Try an example <ArrowUpRight size={19} />
              </Button>
            </section>
            {hasCurrentBill && (
              <p className="entry-save" role="status">
                {saved ? "Saved in this tab." : "Not saved in this tab."}
              </p>
            )}
          </fieldset>
        )}
        {(recoveries.length > 0 || recoveryWarning) && (
          <details className="legacy-recovery">
            <summary>Recover an earlier bill</summary>
            <p>
              These are bills saved by an earlier app version. Recovery replaces
              this tab’s bill; the earlier stored data stays untouched.
            </p>
            {recoveryWarning && (
              <p role="status" className="helper">
                {recoveryWarning}
              </p>
            )}
            {recoveries.map((source) => (
              <Button
                key={source.id}
                variant="outline"
                size="sm"
                onClick={() => requestAction(source.id)}
              >
                {source.label}
              </Button>
            ))}
          </details>
        )}
        {!entry && !linkError && (
          <div className="workspace">
            <fieldset
              className="editor editor-fields"
              disabled={!ready || readOnly}
            >
              <section
                className="card bill-card"
                aria-labelledby="bill-heading"
              >
                <div className="section-heading">
                  <div className="heading-group">
                    <span className="icon-box teal">
                      <Utensils size={19} />
                    </span>
                    <div>
                      <h2 id="bill-heading">The dinner bill</h2>
                      <p>One total. We’ll take it from here.</p>
                    </div>
                  </div>
                </div>
                <label htmlFor="dinner-title" className="field-label">
                  Dinner title
                </label>
                <Input
                  readOnly={readOnly}
                  id="dinner-title"
                  className="dinner-title-input"
                  value={bill.title}
                  placeholder={DEFAULT_TITLE}
                  onChange={(e) => {
                    if (safeInput(e.target.value, 120))
                      setBill({ ...bill, title: e.target.value });
                  }}
                  aria-describedby="title-help"
                />
                <p id="title-help" className="helper title-helper">
                  Shown in your split, message, and shared dinner. Up to 120
                  characters.
                </p>
                <label htmlFor="bill-amount" className="field-label">
                  Total bill amount
                </label>
                <div
                  className={`currency-input ${cents === null ? "invalid" : ""}`}
                >
                  <span>$</span>
                  <Input
                    readOnly={readOnly}
                    id="bill-amount"
                    inputMode="decimal"
                    value={bill.amount}
                    onChange={(e) => {
                      if (safeInput(e.target.value, 128))
                        setBill({ ...bill, amount: e.target.value });
                    }}
                    onBlur={() => {
                      if (cents !== null)
                        setBill((b) => ({
                          ...b,
                          amount: (cents / 100).toFixed(2),
                        }));
                    }}
                    aria-invalid={cents === null}
                    aria-describedby="bill-help"
                  />
                  <span className="currency-code">USD</span>
                </div>
                <p id="bill-help" className="helper">
                  Include any tax and tip in this total.
                </p>
                <div className="bill-stats">
                  <span>
                    <House size={16} />
                    <b>{bill.households.length}</b> households
                  </span>
                  <span>
                    <Users size={16} />
                    <b>{people}</b> people
                  </span>
                  <span className="autosaved">
                    <Check size={13} />
                    {!ready
                      ? "Loading…"
                      : shared
                        ? "Read-only snapshot"
                        : storageWarning || blocked || linkError
                          ? "Not saved"
                          : saved
                            ? "Saved in this tab"
                            : "Ready to edit"}
                  </span>
                </div>
              </section>
              <div className="household-heading">
                <div>
                  <h2>
                    Your table{" "}
                    <span className="count-badge">
                      {bill.households.length}
                    </span>
                  </h2>
                  <p>Who’s joining for dinner?</p>
                </div>
                <a
                  href="#your-split"
                  className="mobile-summary"
                  onClick={(e) => {
                    e.preventDefault();
                    document
                      .getElementById("your-split")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  View split <ArrowDown size={14} />
                </a>
              </div>
              {bill.households.length === 0 && (
                <section className="empty-state">
                  <span className="empty-icon">
                    <House size={29} />
                    <span>♡</span>
                  </span>
                  <h3>A good meal starts with good company.</h3>
                  <p>
                    Add your first household, then invite the little eaters.
                  </p>
                  <Button onClick={addHouse} disabled={!ready}>
                    <Plus size={17} /> Add Household
                  </Button>
                  <span className="empty-hint">
                    Just adults? That works, too.
                  </span>
                </section>
              )}
              {bill.households.map((h, i) => {
                const row = rows[i];
                return (
                  <section
                    className={`card household-card ${colors[i % 4]}`}
                    key={h.id}
                    aria-label={householdName(h, i)}
                  >
                    <div className="household-top">
                      <span className={`family-avatar ${colors[i % 4]}`}>
                        <House size={20} />
                      </span>
                      <Input
                        readOnly={readOnly}
                        id={`household-${h.id}`}
                        aria-label={`Household ${i + 1} name`}
                        placeholder={`Household ${i + 1}`}
                        value={h.name}
                        dir="auto"
                        onChange={(e) =>
                          safeInput(e.target.value) &&
                          patchHouse(h.id, { name: e.target.value })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${householdName(h, i)}`}
                        onClick={() => {
                          if (bill.households.length === 1)
                            focusTarget.current = "entry";
                          setBill((b) => ({
                            ...b,
                            households: b.households.filter(
                              (x) => x.id !== h.id,
                            ),
                          }));
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <div className="adults-row">
                      <div>
                        <label htmlFor={`adults-${h.id}`}>
                          <Users size={16} /> Adults
                        </label>
                        <p>100% portion per adult</p>
                      </div>
                      <div className="stepper">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Fewer adults in ${householdName(h, i)}`}
                          disabled={h.adults === 0}
                          onClick={() =>
                            patchHouse(h.id, { adults: h.adults - 1 })
                          }
                        >
                          −
                        </Button>
                        <Input
                          readOnly={readOnly}
                          id={`adults-${h.id}`}
                          aria-label={`Adults in ${householdName(h, i)}`}
                          type="number"
                          min="0"
                          max="1000"
                          value={h.adults}
                          onChange={(e) =>
                            patchHouse(h.id, {
                              adults: Math.min(
                                1000,
                                Math.max(
                                  0,
                                  Math.floor(Number(e.target.value) || 0),
                                ),
                              ),
                            })
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={h.adults === 1000}
                          aria-label={`More adults in ${householdName(h, i)}`}
                          onClick={() =>
                            patchHouse(h.id, { adults: h.adults + 1 })
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>
                    {h.children.map((c, j) => (
                      <div className="child-card" key={c.id}>
                        <div className="child-fields">
                          <span className="child-emoji" aria-hidden="true">
                            🧒
                          </span>
                          <label className="child-name">
                            <span className="sr-only">
                              Child {j + 1} name in {householdName(h, i)}
                            </span>
                            <Input
                              readOnly={readOnly}
                              placeholder={`Child ${j + 1}`}
                              value={c.name}
                              dir="auto"
                              onChange={(e) =>
                                safeInput(e.target.value) &&
                                patchChild(h.id, c.id, { name: e.target.value })
                              }
                            />
                          </label>
                          <label className="age-field">
                            <span>Age</span>
                            <Input
                              readOnly={readOnly}
                              type="number"
                              min="0"
                              max="17"
                              placeholder="—"
                              value={c.age ?? ""}
                              aria-label={`Age of ${childName(c, j)}`}
                              onChange={(e) => {
                                const value = e.target.value;
                                const age =
                                  value === ""
                                    ? null
                                    : Math.min(
                                        17,
                                        Math.max(
                                          0,
                                          Math.floor(Number(value) || 0),
                                        ),
                                      );
                                patchChild(h.id, c.id, { age });
                              }}
                            />
                          </label>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove ${childName(c, j)}`}
                            onClick={() =>
                              patchHouse(h.id, {
                                children: h.children.filter(
                                  (x) => x.id !== c.id,
                                ),
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="portion-label">
                          <label htmlFor={`slider-${c.id}`}>
                            Adult-equivalent portion
                          </label>
                          <span>{c.percentage}%</span>
                        </div>
                        <input
                          className="portion-slider"
                          id={`slider-${c.id}`}
                          aria-label={`Portion for ${childName(c, j)}`}
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={c.percentage}
                          style={
                            {
                              "--progress": `${c.percentage}%`,
                            } as React.CSSProperties
                          }
                          onChange={(e) =>
                            patchChild(h.id, c.id, {
                              percentage: Number(e.target.value),
                            })
                          }
                        />
                        <div className="slider-scale">
                          <span>0% · little bites</span>
                          <span>100% · adult portion</span>
                        </div>
                        <div className="age-default">
                          <span>
                            {c.age === null
                              ? "Enter an age for a starting suggestion"
                              : `Age suggestion: ${ageDefault(c.age)}%`}
                            {c.overridden ? " · Customized" : ""}
                          </span>
                          <button
                            onClick={() => patchChild(h.id, c.id, {}, true)}
                            className="text-button"
                          >
                            Reset to age default
                          </button>
                        </div>
                      </div>
                    ))}
                    <Button
                      className="add-child"
                      variant="ghost"
                      size="sm"
                      onClick={() => addChild(h.id)}
                    >
                      <Plus size={15} /> Add Child
                    </Button>
                    <div className="household-footer">
                      <span>
                        Combined portion <b>{householdWeight(h)}%</b>
                      </span>
                      <span>
                        Household share{" "}
                        <strong>{error ? "—" : money(row?.cents ?? 0)}</strong>
                      </span>
                    </div>
                  </section>
                );
              })}
              {bill.households.length > 0 && (
                <Button
                  variant="outline"
                  className="add-household"
                  onClick={addHouse}
                >
                  <Plus size={18} /> Add Household
                </Button>
              )}
              <div className="portion-note">
                <Info size={18} />
                <p>
                  <b>Every appetite is different.</b> Age suggestions are just a
                  starting point. Adjust each slider to reflect what your little
                  eater actually ate.
                </p>
              </div>
            </fieldset>
            <aside className="results-column">
              <section
                id="your-split"
                className="card summary-card"
                aria-labelledby="split-heading"
              >
                <div className="section-heading">
                  <div className="heading-group">
                    <span className="icon-box light-teal">
                      <span aria-hidden="true">$</span>
                    </span>
                    <div>
                      <h2 id="split-heading" dir="auto">
                        {billTitle(bill)}
                      </h2>
                      <p>A fair share for every household.</p>
                    </div>
                  </div>
                  <span className="live-badge">
                    <span /> LIVE
                  </span>
                </div>
                {error && (
                  <p role="alert" className="warning">
                    {error}
                  </p>
                )}
                {bill.households.length === 0 ? (
                  <div className="summary-empty">
                    <div className="empty-bars">
                      <span />
                      <span />
                      <span />
                    </div>
                    <p>Your table’s split will appear here.</p>
                    <span>Add a household to get started.</span>
                  </div>
                ) : (
                  <>
                    <div className="table-heading">
                      <span>HOUSEHOLD / PORTION</span>
                      <span>AMOUNT</span>
                    </div>
                    <div className="summary-rows">
                      {bill.households.map((h, i) => (
                        <div className="summary-row" key={h.id}>
                          <div>
                            <span className={`color-dot ${colors[i % 4]}`} />
                            <b dir="auto">{householdName(h, i)}</b>
                            <span className="weight-label">
                              {householdWeight(h)}%
                            </span>
                            <strong data-testid={`payment-${i}`}>
                              {error ? "—" : money(rows[i]?.cents ?? 0)}
                            </strong>
                          </div>
                          <div className="proportion-track">
                            <div
                              className={colors[i % 4]}
                              style={{
                                width: `${totalWeight ? (householdWeight(h) / totalWeight) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="grand-total">
                  <div>
                    <span>Total dinner bill</span>
                    <p>{totalWeight}% combined portions</p>
                  </div>
                  <strong>{cents === null ? "—" : money(cents)}</strong>
                </div>
                <div className="share-summary-action">
                  <Button
                    className="share-dinner-button"
                    onClick={openShare}
                    disabled={
                      !ready ||
                      !!linkError ||
                      !!error ||
                      !bill.households.length
                    }
                  >
                    <Share2 size={17} /> Share
                  </Button>
                  <p>
                    Send a fixed snapshot. Recipients can edit a separate local
                    copy.
                  </p>
                </div>
                <div className="rounding-note">
                  <ShieldCheck size={14} />
                  {bill.households.length && !error
                    ? "Every penny accounted for. Always."
                    : "Fair portions. Exact pennies. Zero awkwardness."}
                </div>
                {bill.households.length > 0 && (
                  <details className="calculation-details">
                    <summary>
                      How is this calculated? <ChevronDown size={14} />
                    </summary>
                    <p>
                      Adults count as 100%. Add the children’s chosen
                      percentages to get each household’s combined portion.
                      Divide that by the group’s {totalWeight}% to find its
                      share.
                    </p>
                    <p>
                      We allocate whole cents, then give remaining pennies to
                      the largest fractional remainders. Ties follow household
                      order.
                    </p>
                    {bill.households.map((h, i) => (
                      <p key={h.id}>
                        {householdName(h, i)}: {householdWeight(h)} ÷{" "}
                        {totalWeight || "—"} ×{" "}
                        {cents === null ? "—" : money(cents)} →{" "}
                        {error ? "—" : money(rows[i]?.cents ?? 0)}
                      </p>
                    ))}
                  </details>
                )}
              </section>
              <section
                className="card message-card"
                aria-labelledby="message-heading"
              >
                <div className="section-heading">
                  <div className="heading-group">
                    <span className="icon-box coral">
                      <MessageCircle size={19} />
                    </span>
                    <div>
                      <h2 id="message-heading">Made for the group chat</h2>
                      <p>A little clarity. A lot of good vibes.</p>
                    </div>
                  </div>
                </div>
                <div className="tone-row">
                  <span>Message tone</span>
                  <div
                    className="tone-switch"
                    role="group"
                    aria-label="Message tone"
                  >
                    <button
                      disabled={readOnly || !ready}
                      aria-pressed={bill.tone === "fun"}
                      onClick={() => setBill({ ...bill, tone: "fun" })}
                    >
                      🎉 Fun
                    </button>
                    <button
                      disabled={readOnly || !ready}
                      aria-pressed={bill.tone === "simple"}
                      onClick={() => setBill({ ...bill, tone: "simple" })}
                    >
                      ✨ Simple
                    </button>
                  </div>
                </div>
                <div
                  className="message-preview"
                  tabIndex={0}
                  aria-label="Message preview"
                >
                  <span className="preview-label">YOUR MESSAGE PREVIEW</span>
                  <p data-testid="message">{message}</p>
                </div>
                <Button
                  className="copy-button"
                  disabled={
                    !ready ||
                    !!error ||
                    !bill.households.length ||
                    !messageInputsSafe
                  }
                  onClick={copy}
                >
                  <Copy size={17} /> 📋 Copy Message
                </Button>
                <p className="copy-help">
                  Ready for WhatsApp, iMessage, or your favorite group chat.
                </p>
              </section>
              <div className="privacy-note">
                <ShieldCheck size={15} />
                <span>
                  Your dinner stays at your table.
                  <br />
                  {shared
                    ? "Read-only link snapshot. No account needed."
                    : "Local to this tab. Share a link to keep it."}
                </span>
              </div>
            </aside>
          </div>
        )}
        {!entry && (
          <footer>
            <span className="footer-brand">
              <Utensils size={15} /> Family Meal Splitter
            </span>
            <span>
              More togetherness. Less “who owes what?” <Heart size={13} />
            </span>
            <span>
              <Leaf size={14} /> A little fairer, by design.
            </span>
          </footer>
        )}
      </main>
      {notice && (
        <div role="status" className="toast">
          <Check size={17} />
          {notice}
        </div>
      )}
      {confirm && (
        <Dialog titleId="confirm-title" onClose={() => setConfirm(null)}>
          <span className="icon-box coral">
            <Info size={21} />
          </span>
          <h2 id="confirm-title">
            {confirm === "new"
              ? "Start a new bill?"
              : confirm === "example"
                ? "Load the example dinner?"
                : "Replace your current bill?"}
          </h2>
          <p>
            {blocked
              ? "Your previous bill could not be read. This action may replace its stored record. "
              : "This replaces your current bill in this tab. "}
            {entry
              ? "Changes that have not been saved may be lost. Keep my bill cancels without replacing stored data."
              : "Keep its share link first if you want to return to it."}
          </p>
          <div>
            <Button
              variant="outline"
              data-autofocus
              onClick={() => setConfirm(null)}
            >
              Keep my bill
            </Button>
            <Button
              onClick={() => {
                performAction(confirm);
                setConfirm(null);
              }}
            >
              {confirm === "new"
                ? "Start new bill"
                : confirm === "example"
                  ? "Load example"
                  : "Replace bill"}
            </Button>
          </div>
        </Dialog>
      )}
      {sharing && (
        <Dialog titleId="share-title" onClose={() => setSharing(false)}>
          <span className="icon-box teal">
            <Share2 size={21} />
          </span>
          <h2 id="share-title">Share this dinner</h2>
          <p>
            This link includes the dinner title, household names, children’s
            ages, and either their names or initials. This app does not store
            dinner details on a server. Your tab saves your draft, and the link
            itself contains the snapshot. Anyone with the link can read its
            contents.
          </p>
          <p className="helper">
            This link saves the values shown now. Share again after editing to
            keep the updated version.
          </p>
          <fieldset className="privacy-choices">
            <legend>Children’s names in this link</legend>
            <label>
              <input
                type="radio"
                name="share-privacy"
                value="initials"
                checked={privacy === "initials"}
                onChange={() => {
                  setPrivacy("initials");
                  setShareLink("");
                  setShareError("");
                }}
              />{" "}
              <span>
                <strong>Use children’s initials</strong>
                <small>For example, Child A1 becomes C. A.</small>
              </span>
            </label>
            <label>
              <input
                type="radio"
                name="share-privacy"
                value="entered"
                checked={privacy === "entered"}
                onChange={() => {
                  setPrivacy("entered");
                  setShareLink("");
                  setShareError("");
                }}
              />{" "}
              <span>
                <strong>Keep names as entered</strong>
                <small>Include the names currently shown in the editor.</small>
              </span>
            </label>
          </fieldset>
          <p className="privacy-detail">
            <strong>Ages stay included in both options.</strong> Household names
            and the dinner title stay as entered. Initials do not make a dinner
            anonymous.
            {bill.households.every((h) => h.children.length === 0)
              ? " This dinner has no child names to abbreviate."
              : ""}
          </p>
          <details className="share-limits">
            <summary>How this link works</summary>
            <p>
              The snapshot is encoded, not encrypted. It can remain in browser
              history and messages. Existing links do not update and cannot be
              individually revoked. Other apps on this GitHub Pages origin share
              browser storage; drafts are not encrypted. Initials already
              received cannot reveal full names that were not included.
            </p>
          </details>
          {shareError && (
            <p role="alert" className="warning">
              {shareError}
            </p>
          )}
          {shareLink && (
            <label className="share-link-label">
              Share link
              <textarea
                readOnly
                aria-label="Share link"
                value={shareLink}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
          <div>
            <Button
              variant="outline"
              data-autofocus
              onClick={() => setSharing(false)}
            >
              Cancel
            </Button>
            <Button onClick={copyShare}>
              <Copy size={16} /> Copy share link
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
