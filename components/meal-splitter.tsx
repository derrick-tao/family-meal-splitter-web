"use client";
import { useEffect, useState } from "react";
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
  RotateCcw,
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
import { useDinner } from "@/hooks/use-dinner";
import { createShareUrl, type NamePrivacy } from "@/lib/sharing";
import { isSafeText } from "@/lib/validation";
import {
  allocate,
  ageDefault,
  childName,
  cleanBill,
  exampleBill,
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
    session,
    legacy,
    readOnly,
    replaceBill,
    resetChanges,
    createLocal,
    viewOriginal,
    openSaved,
  } = useDinner();
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"reset" | "example" | null>(null);
  const [sharing, setSharing] = useState(false);
  const [privacy, setPrivacy] = useState<NamePrivacy>("initials");
  const [shareLink, setShareLink] = useState("");
  const [shareError, setShareError] = useState("");
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
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
  const edited =
    bill.households.length > 0 ||
    (bill.amount !== "" && bill.amount !== "0.00") ||
    bill.tone !== "fun" ||
    bill.title !== DEFAULT_TITLE ||
    !!storageWarning ||
    !!linkError;
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
    setBill((b) => ({
      ...b,
      households: [
        ...b.households,
        { id: crypto.randomUUID(), name: "", adults: 1, children: [] },
      ],
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
  function requestAction(action: "reset" | "example") {
    if (readOnly) return;
    if (action === "reset" && session) {
      setConfirm(action);
      return;
    }
    if (edited) setConfirm(action);
    else replaceBill(action === "reset" ? cleanBill() : exampleBill());
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
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
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
      <main>
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
              <Button variant="ghost" onClick={() => requestAction("example")}>
                <Sparkles size={15} /> Load Example Dinner{" "}
                <ArrowUpRight size={14} />
              </Button>
            )}
          </div>
          <div className="hero-doodle" aria-hidden="true">
            🍽️<span>♡</span>
          </div>
        </section>
        {storageWarning && (
          <p role="status" className="warning">
            {storageWarning}
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
            <Button variant="outline" onClick={openSaved}>
              Open my saved dinner
            </Button>
            <Button onClick={() => createLocal("new")}>Start new dinner</Button>
          </div>
        )}
        {!linkError && ready && (
          <section className="shared-banner" aria-label="Dinner status">
            <div>
              <strong>
                {shared
                  ? "Read-only shared snapshot"
                  : session
                    ? "Local copy"
                    : "Saved dinner"}
              </strong>
              <p>
                {shared
                  ? "This link always shows its original snapshot. Edit a copy to make changes."
                  : session
                    ? "This copy is local to this tab. Use Share changes to create a link that others can open or that you can keep for later."
                    : "Your ordinary dinner is saved in this browser."}
              </p>
            </div>
            <div className="shared-actions">
              {shared && (
                <Button size="sm" onClick={() => createLocal("copy")}>
                  Edit a copy
                </Button>
              )}
              {shared && legacy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => createLocal("recover")}
                >
                  Recover previous edits as a local copy
                </Button>
              )}
              {session?.source && (
                <Button variant="outline" size="sm" onClick={viewOriginal}>
                  View original snapshot
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => createLocal("new")}
              >
                Start new dinner
              </Button>
              {(shared || session) && (
                <Button variant="ghost" size="sm" onClick={openSaved}>
                  Open my saved dinner
                </Button>
              )}
            </div>
            {session && (
              <details>
                <summary>About local copies</summary>
                <p>
                  One working copy is kept per tab when session storage is
                  available. Refresh can restore it while that page session
                  remains available. Browsers may restore sessions or copy their
                  initial state into a duplicated tab; those copies then edit
                  independently. A local copy address does not transfer dinner
                  data. Use Share changes to keep a portable snapshot.
                </p>
              </details>
            )}
          </section>
        )}
        {!linkError && (
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
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => requestAction("reset")}
                    >
                      <RotateCcw size={14} />{" "}
                      {session ? "Reset changes" : "Reset saved dinner"}
                    </Button>
                  )}
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
                          : session
                            ? "Saved in this tab"
                            : "Saved on this device"}
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
                        onClick={() =>
                          setBill((b) => ({
                            ...b,
                            households: b.households.filter(
                              (x) => x.id !== h.id,
                            ),
                          }))
                        }
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
                    <Share2 size={17} />{" "}
                    {session ? "Share changes" : "Share dinner"}
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
                    : session
                      ? "Local to this tab. Share a link to keep it."
                      : "Saved only in this browser. No account needed."}
                </span>
              </div>
            </aside>
          </div>
        )}
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
            <RotateCcw size={21} />
          </span>
          <h2 id="confirm-title">
            {confirm === "reset"
              ? session
                ? "Reset changes?"
                : "Reset saved dinner?"
              : "Load the example dinner?"}
          </h2>
          <p>
            {confirm === "reset"
              ? session
                ? "This discards your changes and restores this local copy’s complete starting values. The local copy address stays the same."
                : "This clears the ordinary dinner saved in this browser. A separate local copy is kept."
              : "This will replace the currently open dinner with the fictional four-family dinner. A local copy’s starting values stay unchanged."}
          </p>
          <div>
            <Button
              variant="outline"
              data-autofocus
              onClick={() => setConfirm(null)}
            >
              Keep my dinner
            </Button>
            <Button
              onClick={() => {
                if (confirm === "reset" && session) resetChanges();
                else
                  replaceBill(
                    confirm === "reset" ? cleanBill() : exampleBill(),
                  );
                setConfirm(null);
              }}
            >
              {confirm === "reset"
                ? session
                  ? "Reset changes"
                  : "Reset saved dinner"
                : "Load example"}
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
            dinner details on a server. Your browser saves your draft, and the
            link itself contains the snapshot. Anyone with the link can read its
            contents.
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
