import { Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatCurrency, initials } from "../../lib/format";
import { COLLAB_STATUS_LABELS, COLLAB_STATUS_OPTIONS, TICKET_STATUS_BADGE, TICKET_STATUS_LABELS } from "../../lib/partnership-stages";
import type { PartnershipCollabStatus, PartnershipEditorTicket, PartnershipTicketDetail } from "../../lib/types";
import { RemarkTimeline } from "./RemarkTimeline";

type Panel = null | "respond" | "counter" | "change" | "verify" | "metadata";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function isEditorTicket(t: PartnershipTicketDetail | PartnershipEditorTicket): t is PartnershipEditorTicket {
  return !("requested_ad_rights" in t);
}

export function TicketDetailDrawer({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<PartnershipTicketDetail | PartnershipEditorTicket | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Respond (advisor)
  const [adCode, setAdCode] = useState("");
  const [duration, setDuration] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [agentCounter, setAgentCounter] = useState("");
  // Respond (editor) / shared
  const [ctaLink, setCtaLink] = useState("");
  const [remark, setRemark] = useState("");
  // Admin counter
  const [adminCounter, setAdminCounter] = useState("");
  const [counterStatus, setCounterStatus] = useState<PartnershipCollabStatus>("open");
  // Verify close
  const [lockedAmount, setLockedAmount] = useState("");
  // Video metadata (content bucket / language)
  const [metaContentBucket, setMetaContentBucket] = useState("");
  const [metaLanguage, setMetaLanguage] = useState("");

  function load() {
    api.get(`/partnership/${ticketId}`).then((res) => setTicket(res.data));
  }

  useEffect(load, [ticketId]);

  function refresh() {
    load();
    onChanged();
  }

  function closePanel() {
    setPanel(null);
    setError(null);
    setAdCode("");
    setDuration("");
    setExpiresAt("");
    setAgentCounter("");
    setCtaLink("");
    setRemark("");
    setAdminCounter("");
    setLockedAmount("");
    setMetaContentBucket("");
    setMetaLanguage("");
  }

  async function submitRespond() {
    if (!remark.trim()) return setError("A remark is required.");
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { remark };
      if (user?.role === "editor") {
        if (!ctaLink.trim()) {
          setSubmitting(false);
          return setError("CTA link is required.");
        }
        payload.cta_link = ctaLink;
      } else {
        if (adCode) payload.ad_code = adCode;
        if (duration) payload.ad_right_duration_days = Number(duration);
        if (expiresAt) payload.ad_right_expires_at = expiresAt;
        if (agentCounter) payload.ad_rights_agent_counter = Number(agentCounter);
      }
      await api.post(`/partnership/${ticketId}/respond`, payload);
      closePanel();
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not submit this response.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCounter() {
    if (!adminCounter) return setError("Enter a counter amount.");
    if (!remark.trim()) return setError("A remark is required.");
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/partnership/${ticketId}/send-counter`, {
        ad_rights_admin_counter: Number(adminCounter),
        collab_status: counterStatus,
        remark,
      });
      closePanel();
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not send counter.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitChange() {
    if (!remark.trim()) return setError("A remark is required.");
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/partnership/${ticketId}/request-change`, { remark });
      closePanel();
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not request a change.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitVerify() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/partnership/${ticketId}/verify-close`, {
        ad_rights_amount: lockedAmount ? Number(lockedAmount) : null,
        remark: remark || null,
      });
      closePanel();
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not verify and close this ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitMetadata() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/partnership/${ticketId}/metadata`, {
        content_bucket: metaContentBucket.trim() || null,
        language: metaLanguage.trim() || null,
      });
      closePanel();
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not save video details.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ticket) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30">
        <div className="fixed right-0 top-0 h-full w-[46vw] min-w-[480px] bg-white p-6 shadow-lg">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const editorView = isEditorTicket(ticket);
  // Only read when !editorView; the runtime guard on each usage keeps this safe.
  const full = ticket as PartnershipTicketDetail;
  const isAdmin = user?.role === "admin";
  const isAdvisor = user?.role === "advisor";
  const isEditor = user?.role === "editor";
  const canSeeCommercial = isAdmin || isAdvisor;
  const badge = TICKET_STATUS_BADGE[ticket.ticket_status];

  const canRespond =
    ticket.ticket_status === "pending_at_user" &&
    ((isAdvisor && !editorView) || (isEditor && editorView));
  const canAdminAct = isAdmin && ticket.ticket_status !== "closed_and_live";
  const canEditMetadata = !editorView && (isAdmin || isAdvisor);

  function openMetadataPanel() {
    setMetaContentBucket(full.content_bucket ?? "");
    setMetaLanguage(full.language ?? "");
    setError(null);
    setPanel("metadata");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <aside
        className="fixed right-0 top-0 flex h-full w-[46vw] min-w-[480px] flex-col bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
          <div>
            <div className="text-xs text-gray-400">{ticket.collab_code}</div>
            <div className="text-base font-semibold text-ink">{ticket.video_name}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge}`}>
                {TICKET_STATUS_LABELS[ticket.ticket_status]}
              </span>
              {!editorView && (
                <span className="text-xs text-gray-400">{COLLAB_STATUS_LABELS[full.collab_status]}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Owner</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink">
                <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gray-100 text-[7px] font-extrabold text-[#625d69]">
                  {initials(ticket.owner_name)}
                </div>
                {ticket.owner_name}
              </div>
            </div>
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Live date</div>
              <div className="mt-1 text-sm font-bold text-ink">{formatDate(ticket.live_date)}</div>
            </div>
            <div className="rounded-card border border-[#e7e5e4] p-3">
              <div className="text-[10px] text-muted">Products</div>
              <div className="mt-1 text-sm font-bold text-ink">{ticket.product_names.join(", ") || "—"}</div>
            </div>
            {!editorView && (
              <div className="rounded-card border border-[#e7e5e4] p-3">
                <div className="text-[10px] text-muted">Aging</div>
                <div className="mt-1 text-sm font-bold text-ink">
                  {full.aging_bucket ? `${full.aging_bucket} · ${full.aging_days}d` : "—"}
                </div>
              </div>
            )}
            {!editorView && (
              <div className="rounded-card border border-[#e7e5e4] p-3">
                <div className="text-[10px] text-muted">Content bucket</div>
                <div className="mt-1 text-sm font-bold text-ink">{full.content_bucket ?? "—"}</div>
              </div>
            )}
            {!editorView && (
              <div className="rounded-card border border-[#e7e5e4] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-muted">Language</div>
                  {canEditMetadata && (
                    <button
                      onClick={openMetadataPanel}
                      title="Edit content bucket / language"
                      className="text-gray-400 hover:text-brand-600"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
                <div className="mt-1 text-sm font-bold text-ink">{full.language ?? "—"}</div>
              </div>
            )}
          </div>

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-ink">CTA link</h3>
            <div className="mt-2 rounded-card border border-[#e7e5e4] p-3">
              {ticket.cta_link ? (
                <a href={ticket.cta_link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-600 hover:underline">
                  {ticket.cta_link}
                </a>
              ) : (
                <span className="text-sm text-gray-400">Not submitted yet.</span>
              )}
            </div>
          </div>

          {!editorView && canSeeCommercial && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-ink">Ad rights &amp; commercial</h3>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
                  <div className="text-[10px] text-muted">Creator quote</div>
                  <div className="mt-1 text-sm font-bold text-ink">{formatCurrency(full.ad_rights_creator_quote)}</div>
                </div>
                <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
                  <div className="text-[10px] text-muted">Agent counter</div>
                  <div className="mt-1 text-sm font-bold text-ink">{formatCurrency(full.ad_rights_agent_counter)}</div>
                </div>
                <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
                  <div className="text-[10px] text-muted">Admin counter</div>
                  <div className="mt-1 text-sm font-bold text-ink">{formatCurrency(full.ad_rights_admin_counter)}</div>
                </div>
                <div className="rounded-card border border-[#dddcf8] bg-[#f9f8ff] p-3">
                  <div className="text-[10px] text-muted">Locked amount</div>
                  <div className="mt-1 text-sm font-bold text-ink">{formatCurrency(full.ad_rights_amount)}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Ad code</div>
                  <div className="mt-1 text-sm font-bold text-ink">{full.ad_code ?? "Not added"}</div>
                </div>
                <div className="rounded-card border border-[#e7e5e4] p-3">
                  <div className="text-[10px] text-muted">Ad right duration</div>
                  <div className="mt-1 text-sm font-bold text-ink">
                    {full.ad_right_duration_days ? `${full.ad_right_duration_days}d · exp ${formatDate(full.ad_right_expires_at)}` : "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">Timeline</h3>
            <RemarkTimeline remarks={ticket.remarks} />
          </div>

          {panel && (
            <div className="mt-4 rounded-card border border-brand-200 bg-[#f9f8ff] p-4">
              {panel === "metadata" && (
                <>
                  <h4 className="mb-3 text-sm font-semibold text-ink">Edit video details</h4>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Content bucket</label>
                  <input
                    value={metaContentBucket}
                    onChange={(e) => setMetaContentBucket(e.target.value)}
                    placeholder="e.g. Unboxing, Tutorial, Review"
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-gray-700">Language</label>
                  <input
                    value={metaLanguage}
                    onChange={(e) => setMetaLanguage(e.target.value)}
                    placeholder="e.g. Hindi / Hinglish"
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closePanel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={submitMetadata}
                      disabled={submitting}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : "Save →"}
                    </button>
                  </div>
                </>
              )}

              {panel === "respond" && (
                <>
                  <h4 className="mb-3 text-sm font-semibold text-ink">Respond to this request</h4>
                  {isEditor ? (
                    <>
                      <label className="mb-1 block text-xs font-medium text-gray-700">CTA link</label>
                      <input
                        value={ctaLink}
                        onChange={(e) => setCtaLink(e.target.value)}
                        placeholder="https://..."
                        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Ad code</label>
                      <input
                        value={adCode}
                        onChange={(e) => setAdCode(e.target.value)}
                        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Duration (days)</label>
                          <input
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Expires on</label>
                          <input
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Your counter (₹)</label>
                      <input
                        type="number"
                        value={agentCounter}
                        onChange={(e) => setAgentCounter(e.target.value)}
                        className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </>
                  )}
                  <label className="mb-1 block text-xs font-medium text-gray-700">Remark · Required</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={2}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closePanel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={submitRespond}
                      disabled={submitting}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {submitting ? "Sending..." : "Submit response →"}
                    </button>
                  </div>
                </>
              )}

              {panel === "counter" && (
                <>
                  <h4 className="mb-3 text-sm font-semibold text-ink">Send counter</h4>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Admin counter (₹)</label>
                  <input
                    type="number"
                    value={adminCounter}
                    onChange={(e) => setAdminCounter(e.target.value)}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-gray-700">Collab status</label>
                  <select
                    value={counterStatus}
                    onChange={(e) => setCounterStatus(e.target.value as PartnershipCollabStatus)}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {COLLAB_STATUS_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Remark · Required</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={2}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closePanel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={submitCounter}
                      disabled={submitting}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {submitting ? "Sending..." : "Send counter →"}
                    </button>
                  </div>
                </>
              )}

              {panel === "change" && (
                <>
                  <h4 className="mb-3 text-sm font-semibold text-ink">Request a change</h4>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Remark · Required</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    placeholder="Explain what needs to change..."
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closePanel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={submitChange}
                      disabled={submitting}
                      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {submitting ? "Sending..." : "Request change →"}
                    </button>
                  </div>
                </>
              )}

              {panel === "verify" && (
                <>
                  <h4 className="mb-3 text-sm font-semibold text-ink">Verify &amp; close</h4>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Locked amount (₹)</label>
                  <input
                    type="number"
                    value={lockedAmount}
                    onChange={(e) => setLockedAmount(e.target.value)}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  <label className="mb-1 block text-xs font-medium text-gray-700">Remark</label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={2}
                    className="mb-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={closePanel} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                      Cancel
                    </button>
                    <button
                      onClick={submitVerify}
                      disabled={submitting}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submitting ? "Closing..." : "Verify · Closed & Live →"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {(canRespond || canAdminAct) && !panel && (
          <footer className="flex items-center justify-end gap-2 border-t border-[#e7e5e4] p-4">
            {canRespond && (
              <button
                onClick={() => setPanel("respond")}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700"
              >
                Respond
              </button>
            )}
            {canAdminAct && (
              <>
                <button
                  onClick={() => setPanel("change")}
                  className="rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
                >
                  Request change
                </button>
                <button
                  onClick={() => setPanel("counter")}
                  className="rounded-lg border border-[#e7e5e4] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface"
                >
                  Send counter
                </button>
                <button
                  onClick={() => setPanel("verify")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Verify · Closed &amp; Live →
                </button>
              </>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
