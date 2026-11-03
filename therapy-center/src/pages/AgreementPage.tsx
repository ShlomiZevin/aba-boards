import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agreementApi, kidsApi, parentsApi, notificationsApi } from '../api/client';
import { useTherapist } from '../contexts/TherapistContext';
import { useAuth } from '../contexts/AuthContext';
import { useTherapistLinks } from '../hooks/useTherapistLinks';
import { buildDefaultAgreement } from '../utils/agreementTemplate';
import { toDate } from '../utils/date';
import SignaturePad from '../components/SignaturePad';
import ConfirmModal from '../components/ConfirmModal';
import { signatureSlotKey, agreementIsSigned, DEFAULT_ADMIN_ROLE } from '../types';
import type { Agreement, AgreementSignature, Parent } from '../types';

// The treatment agreement, signed by the centre and by each parent.
//
// The same page serves the admin (/kid/:kidId/agreement) and the parents
// (/p/:kidId/agreement). What differs is who may edit the text and which
// signature slot the viewer can write into.
//
// A parent who isn't on record yet (reached through a shared WhatsApp link)
// signs as NEW_PARENT: the name they type registers them as the kid's parent.
//
// Two rules hold everywhere, and the server enforces both:
//   * once any party has signed, the text can no longer be changed;
//   * a signature can be re-drawn by the person who made it, but never removed.

const DEFAULT_NOTICE_WEEKS = 2;
const NEW_PARENT = '__new';

function formatDateTime(value: unknown): string {
  const d = toDate(value);
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** One signature slot — filled or still waiting. */
function SignatureSlot({
  label,
  role,
  signature,
  canSign,
  onSign,
}: {
  label: string;
  role: string;
  signature?: AgreementSignature;
  canSign: boolean;
  onSign: () => void;
}) {
  return (
    <div className={`signature-slot${signature ? ' signed' : ''}`}>
      <div className="signature-slot-head">
        <div>
          <div className="signature-slot-name">{label}</div>
          <div className="signature-slot-role">{role}</div>
        </div>
        {signature ? (
          <span className="signature-badge signed">נחתם</span>
        ) : (
          <span className="signature-badge pending">ממתין לחתימה</span>
        )}
      </div>

      {signature ? (
        <>
          <img src={signature.signatureImage} alt={`חתימת ${label}`} className="signature-image" />
          <div className="signature-slot-meta">
            נחתם ב־{formatDateTime(signature.signedAt)}
            {signature.revision > 1 && (
              <> · עודכן ב־{formatDateTime(signature.updatedAt)} (עדכון {signature.revision})</>
            )}
          </div>
          {canSign && (
            <button type="button" onClick={onSign} className="btn-secondary btn-small">
              עדכון החתימה
            </button>
          )}
        </>
      ) : (
        <div className="signature-slot-empty">
          {canSign ? (
            <button type="button" onClick={onSign} className="btn-primary btn-small">
              חתמו כאן
            </button>
          ) : (
            <span className="empty-text">טרם נחתם</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgreementPage() {
  const { kidId: urlKidId } = useParams<{ kidId: string }>();
  const { isParentView, parentKidId } = useTherapist();
  const kidId = urlKidId || parentKidId;
  const { user: authUser } = useAuth();
  const links = useTherapistLinks();
  const queryClient = useQueryClient();
  const isAdmin = !isParentView;

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftNotice, setDraftNotice] = useState(DEFAULT_NOTICE_WEEKS);
  const [draftStart, setDraftStart] = useState('');
  const [draftAdminRole, setDraftAdminRole] = useState(DEFAULT_ADMIN_ROLE);
  const [error, setError] = useState<string | null>(null);

  // Signing modal state
  const [signingFor, setSigningFor] = useState<{ type: 'admin' | 'parent'; id: string; name: string } | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [confirmedName, setConfirmedName] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [copied, setCopied] = useState(false);

  // Which parent the viewer says they are. With a single parent on record we
  // can pick for them; otherwise they choose before signing.
  const [activeParentId, setActiveParentId] = useState<string>('');

  const { data: kidRes } = useQuery({
    queryKey: ['kid', kidId],
    queryFn: () => kidsApi.getById(kidId!),
    enabled: !!kidId,
  });

  const { data: parentsRes } = useQuery({
    queryKey: ['parents', kidId],
    queryFn: () => parentsApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const { data: agreementRes, isLoading } = useQuery({
    queryKey: ['agreement', kidId],
    queryFn: () => agreementApi.getForKid(kidId!),
    enabled: !!kidId,
  });

  const kid = kidRes?.data;
  const parents: Parent[] = useMemo(() => parentsRes?.data || [], [parentsRes]);
  const agreement: Agreement | null = agreementRes?.data ?? null;
  const signatures = agreement?.signatures || {};
  const isSigned = agreementIsSigned(agreement);

  useEffect(() => {
    if (parents.length === 1) setActiveParentId(parents[0].id);
  }, [parents]);

  const saveMutation = useMutation({
    mutationFn: (data: { content: string; title: string; noticeWeeks: number; adminRole: string; startDate: string | null; status: 'draft' | 'active' }) =>
      agreementApi.save(kidId!, data),
    onSuccess: (res, vars) => {
      if (!res.success) { setError(res.error || 'השמירה נכשלה'); return; }
      setError(null);
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['agreement', kidId] });
      // Just sent for signing → offer to email the parents their link
      if (vars.status === 'active' && agreement?.status !== 'active' && parents.length > 0) {
        emailMutation.reset();
        setShowEmail(true);
      }
    },
  });

  const signMutation = useMutation({
    mutationFn: (data: { signatureImage: string; parentId?: string; newParentName?: string }) => agreementApi.sign(kidId!, data),
    onSuccess: (res) => {
      if (!res.success) { setError(res.error || 'החתימה נכשלה'); return; }
      setError(null);
      setSigningFor(null);
      setSignatureImage(null);
      setConfirmedName('');
      queryClient.invalidateQueries({ queryKey: ['agreement', kidId] });
      // A newly registered parent appears in the list
      queryClient.invalidateQueries({ queryKey: ['parents', kidId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => agreementApi.delete(kidId!),
    onSuccess: (res) => {
      if (!res.success) { setError(res.error || 'המחיקה נכשלה'); return; }
      setShowDelete(false);
      queryClient.invalidateQueries({ queryKey: ['agreement', kidId] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: () => agreementApi.emailParents(kidId!),
    onSuccess: (res) => {
      if (res.success && res.data) queryClient.setQueryData(['agreement', kidId], { success: true, data: res.data.agreement });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: () => notificationsApi.send({
      kidId: kidId!,
      message: 'הסכם ההתקשרות לטיפול ממתין לחתימתכם. ניתן לעיין ולחתום בעמוד "הסכם טיפול".',
      targets: parents.map(p => ({ type: 'parent', id: p.id, name: p.name })),
    }),
  });

  // Builds the default wording from what is already on record. Depends on the
  // date and role being edited, since both appear in the text.
  const buildText = useCallback((startDate: string, analystRole: string, noticeWeeks: number) =>
    buildDefaultAgreement({
      childName: kid?.name || '',
      parentNames: parents.map(p => p.name),
      analystName: authUser?.name || '',
      analystRole: analystRole || DEFAULT_ADMIN_ROLE,
      analystContact: [authUser?.mobile, authUser?.email].filter(Boolean).join(' · ') || undefined,
      startDate: startDate || null,
      noticeWeeks,
    }), [kid?.name, parents, authUser?.name, authUser?.mobile, authUser?.email]);

  // The last text we generated. Used to tell an untouched default apart from
  // wording the analyst has edited by hand.
  const lastGenerated = useRef('');

  function startEditing() {
    const text = agreement?.content
      || buildText('', DEFAULT_ADMIN_ROLE, agreement?.noticeWeeks || DEFAULT_NOTICE_WEEKS);
    lastGenerated.current = agreement?.content ? '' : text;
    setDraftTitle(agreement?.title || 'הסכם התקשרות לטיפול ABA');
    setDraftContent(text);
    setDraftNotice(agreement?.noticeWeeks || DEFAULT_NOTICE_WEEKS);
    setDraftStart(agreement?.startDate || '');
    setDraftAdminRole(agreement?.adminRole || DEFAULT_ADMIN_ROLE);
    setIsEditing(true);
    setError(null);
  }

  // Changing the date, the role or the notice period rewrites the text — but
  // only while it is still the untouched default, so hand edits survive.
  useEffect(() => {
    if (!isEditing) return;
    if (!lastGenerated.current || draftContent !== lastGenerated.current) return;
    const next = buildText(draftStart, draftAdminRole, draftNotice);
    if (next === draftContent) return;
    lastGenerated.current = next;
    setDraftContent(next);
  }, [isEditing, draftStart, draftAdminRole, draftNotice, draftContent, buildText]);

  function submitSignature() {
    if (!signatureImage || !signingFor) return;
    setError(null);
    const isNewParent = signingFor.type === 'parent' && signingFor.id === NEW_PARENT;
    signMutation.mutate({
      signatureImage,
      parentId: signingFor.type === 'parent' && !isNewParent ? signingFor.id : undefined,
      newParentName: isNewParent ? confirmedName.trim() : undefined,
    });
  }

  const parentLink = `${window.location.origin}/therapy/p/${encodeURIComponent(kidId || '')}/agreement`;

  /** Opens WhatsApp (app on a phone, web on a computer) with the link ready to send. */
  function shareOnWhatsApp() {
    const text = `שלום, מצורף הסכם הטיפול של ${kid?.name || 'ילדכם'} לעיון ולחתימה:\n${parentLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  function copyParentLink() {
    const url = parentLink;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const adminSlotKey = agreement ? signatureSlotKey('admin', agreement.adminId) : '';
  const adminSignature = signatures[adminSlotKey];

  // The viewer's own slot: the admin signs as the centre; a parent signs as
  // whichever parent they identified themselves as.
  const mySignature = isAdmin
    ? adminSignature
    : (activeParentId ? signatures[signatureSlotKey('parent', activeParentId)] : undefined);

  const signedCount = Object.keys(signatures).length;
  const totalSlots = 1 + parents.length;

  if (!kidId) return <div className="container">חסר מזהה ילד</div>;
  if (isLoading) return <div className="container">טוען…</div>;

  return (
    <div className="container agreement-page" style={{ direction: 'rtl' }}>
      <div className="agreement-header">
        <div>
          <Link to={isParentView ? `/p/${kidId}` : links.kidDetail(kidId)} className="back-link">← חזרה</Link>
          <h1>הסכם טיפול {kid?.name ? `— ${kid.name}` : ''}</h1>
        </div>
        {agreement && (
          <div className="agreement-status-chip">
            {signedCount} מתוך {totalSlots} חתימות
          </div>
        )}
      </div>

      {error && <div className="agreement-error">{error}</div>}

      {/* ---------- No agreement yet ---------- */}
      {!agreement && !isEditing && (
        <div className="content-card agreement-empty">
          {isAdmin ? (
            <>
              <h3>עדיין לא נוצר הסכם עבור {kid?.name || 'הילד'}</h3>
              <p>
                ניתן ליצור הסכם התקשרות מנוסח מראש, לערוך אותו לפי הצורך, ולשלוח אותו
                לחתימת ההורים. ההסכם כולל אפשרות סיום בהודעה מוקדמת של {DEFAULT_NOTICE_WEEKS} שבועות
                לכל אחד מהצדדים.
              </p>
              <button onClick={startEditing} className="btn-primary">צור הסכם</button>
            </>
          ) : (
            <>
              <h3>אין הסכם לחתימה</h3>
              <p>כרגע לא ממתין הסכם לחתימתכם. אם קיבלתם בקשה לחתום, פנו למנתח/ת ההתנהגות.</p>
            </>
          )}
        </div>
      )}

      {/* ---------- Editing (admin, before any signature) ---------- */}
      {isEditing && (
        <div className="content-card">
          <div className="form-group">
            <label>כותרת ההסכם</label>
            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
          </div>

          <div className="agreement-edit-row">
            <div className="form-group">
              <label>תקופת הודעה מוקדמת (שבועות)</label>
              <input
                type="number"
                min={1}
                max={12}
                value={draftNotice}
                onChange={(e) => setDraftNotice(Number(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>תאריך תחילת טיפול</label>
              <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>התפקיד שיוצג לצד חתימתך</label>
            <input
              value={draftAdminRole}
              onChange={(e) => setDraftAdminRole(e.target.value)}
              placeholder={DEFAULT_ADMIN_ROLE}
            />
            <div className="form-hint">מוצג לצד חתימתך בתחתית ההסכם, וגם בפתיחת ההסכם.</div>
          </div>

          <div className="form-group">
            <label>נוסח ההסכם</label>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              className="agreement-textarea"
              rows={24}
            />
            <button
              type="button"
              className="btn-secondary btn-small"
              style={{ marginTop: 8 }}
              onClick={() => {
                const next = buildText(draftStart, draftAdminRole, draftNotice);
                lastGenerated.current = next;
                setDraftContent(next);
              }}
            >
              אפס לנוסח ברירת המחדל
            </button>
          </div>

          <div className="modal-actions">
            <button
              onClick={() => { setIsEditing(false); setError(null); }}
              className="btn-secondary"
            >ביטול</button>
            <button
              onClick={() => saveMutation.mutate({
                title: draftTitle, content: draftContent, noticeWeeks: draftNotice,
                adminRole: draftAdminRole, startDate: draftStart || null, status: 'draft',
              })}
              className="btn-secondary"
              disabled={saveMutation.isPending || !draftContent.trim()}
            >שמור כטיוטה</button>
            <button
              onClick={() => saveMutation.mutate({
                title: draftTitle, content: draftContent, noticeWeeks: draftNotice,
                adminRole: draftAdminRole, startDate: draftStart || null, status: 'active',
              })}
              className="btn-primary"
              disabled={saveMutation.isPending || !draftContent.trim()}
            >שמור ושלח לחתימה</button>
          </div>
        </div>
      )}

      {/* ---------- The agreement ---------- */}
      {agreement && !isEditing && (
        <>
          {isAdmin && (
            <div className="agreement-toolbar">
              {agreement.status === 'draft' && (
                <span className="agreement-badge draft">טיוטה — לא נשלח לחתימה</span>
              )}
              {agreement.status === 'active' && !isSigned && (
                <span className="agreement-badge active">נשלח לחתימה</span>
              )}
              {isSigned && (
                <span className="agreement-badge locked">נחתם — הנוסח נעול לשינוי</span>
              )}

              {!isSigned && (
                <button onClick={startEditing} className="btn-secondary btn-small">ערוך נוסח</button>
              )}
              {agreement.status === 'draft' && (
                <button
                  onClick={() => saveMutation.mutate({
                    title: agreement.title, content: agreement.content,
                    noticeWeeks: agreement.noticeWeeks, adminRole: agreement.adminRole,
                    startDate: agreement.startDate, status: 'active',
                  })}
                  className="btn-primary btn-small"
                >שלח לחתימה</button>
              )}
              {agreement.status === 'active' && parents.length > 0 && (
                <button
                  onClick={() => { emailMutation.reset(); setShowEmail(true); }}
                  className="btn-primary btn-small"
                >
                  📧 שליחה במייל להורים
                </button>
              )}
              {agreement.status === 'active' && parents.length > 0 && (
                <button
                  onClick={() => notifyMutation.mutate()}
                  className="btn-secondary btn-small"
                  disabled={notifyMutation.isPending}
                >
                  {notifyMutation.isSuccess ? 'נשלחה תזכורת ✓' : 'שלח תזכורת להורים'}
                </button>
              )}
              {agreement.status === 'active' && (
                <>
                  <button onClick={copyParentLink} className="btn-secondary btn-small">
                    {copied ? 'הקישור הועתק ✓' : '🔗 העתקת קישור לחתימה'}
                  </button>
                  <button onClick={shareOnWhatsApp} className="btn-secondary btn-small btn-whatsapp">
                    שליחה בוואטסאפ
                  </button>
                </>
              )}
              <button onClick={() => window.print()} className="btn-secondary btn-small">הדפסה</button>
              {!isSigned && (
                <button onClick={() => setShowDelete(true)} className="btn-danger btn-small">מחק</button>
              )}
            </div>
          )}

          {isParentView && agreement.status === 'active' && !mySignature && (
            <div className="agreement-callout">
              יש לעיין בהסכם ולחתום בתחתית העמוד.
            </div>
          )}

          <div className="content-card agreement-document">
            <h2 className="agreement-title">{agreement.title}</h2>
            <pre className="agreement-content">{agreement.content}</pre>
          </div>

          {/* ---------- Signatures ---------- */}
          <div className="content-card">
            <div className="dashboard-card-header">
              <h3>חתימות הצדדים</h3>
            </div>

            {agreement.status !== 'active' ? (
              <p className="empty-text">ההסכם יהיה זמין לחתימה לאחר שיישלח להורים.</p>
            ) : (
              <>
                {/* A parent must say which parent they are before signing. */}
                {isParentView && parents.length > 0 && (
                  <div className="form-group agreement-whoami">
                    <label>מי חותם/ת כרגע?</label>
                    <select value={activeParentId} onChange={(e) => setActiveParentId(e.target.value)}>
                      <option value="">— בחרו את שמכם —</option>
                      {parents.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      <option value={NEW_PARENT}>השם שלי לא ברשימה</option>
                    </select>
                  </div>
                )}

                <div className="signature-grid">
                  <SignatureSlot
                    label={adminSignature?.signerName || authUser?.name || agreement.adminRole || DEFAULT_ADMIN_ROLE}
                    role={adminSignature?.signerRole || agreement.adminRole || DEFAULT_ADMIN_ROLE}
                    signature={adminSignature}
                    canSign={isAdmin}
                    onSign={() => {
                      setSignatureImage(null);
                      setConfirmedName('');
                      setSigningFor({
                        type: 'admin',
                        id: agreement.adminId,
                        name: authUser?.name || agreement.adminRole || DEFAULT_ADMIN_ROLE,
                      });
                    }}
                  />

                  {parents.length === 0 && !isParentView && (
                    <div className="signature-slot">
                      <p className="empty-text">
                        לא רשומים הורים אצל הילד. ההורים יכולים לחתום דרך הקישור — השם שיקלידו בחתימה יירשם אצל הילד.
                      </p>
                    </div>
                  )}

                  {/* A parent not on record: signing with their name registers them */}
                  {isParentView && (parents.length === 0 || activeParentId === NEW_PARENT) && (
                    <SignatureSlot
                      label={parents.length === 0 ? 'הורה' : 'הורה נוסף'}
                      role="הורה / אפוטרופוס"
                      canSign
                      onSign={() => {
                        setSignatureImage(null);
                        setConfirmedName('');
                        setSigningFor({ type: 'parent', id: NEW_PARENT, name: '' });
                      }}
                    />
                  )}

                  {parents.map((p) => {
                    const sig = signatures[signatureSlotKey('parent', p.id)];
                    // A parent may only write into the slot they identified as.
                    const isMe = isParentView && activeParentId === p.id;
                    return (
                      <SignatureSlot
                        key={p.id}
                        label={p.name}
                        role="הורה / אפוטרופוס"
                        signature={sig}
                        canSign={isMe}
                        onSign={() => {
                          setSignatureImage(null);
                          setConfirmedName('');
                          setSigningFor({ type: 'parent', id: p.id, name: p.name });
                        }}
                      />
                    );
                  })}
                </div>

                {isParentView && parents.length > 0 && !activeParentId && (
                  <p className="empty-text" style={{ marginTop: 12 }}>
                    בחרו את שמכם מהרשימה למעלה כדי לחתום.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ---------- Signing modal ---------- */}
      {signingFor && (
        <div className="modal-overlay">
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl' }}>
            <h3>{mySignature ? 'עדכון חתימה' : 'חתימה על ההסכם'}</h3>

            <p className="signing-intro">
              {signingFor.name || confirmedName.trim() || 'הורה'} — בחתימה זו אני מאשר/ת כי קראתי את ההסכם, הבנתי את תוכנו
              ואני מסכים/ה לו, לרבות האפשרות לסיים את ההתקשרות בהודעה מוקדמת של{' '}
              {agreement?.noticeWeeks || DEFAULT_NOTICE_WEEKS} שבועות.
            </p>

            {mySignature && (
              <p className="signing-note">
                חתמתם על הסכם זה ב־{formatDateTime(mySignature.signedAt)}. חתימה חדשה תחליף
                את הקודמת; לא ניתן לבטל חתימה שנעשתה.
              </p>
            )}

            <div className="form-group">
              <label>הקלידו את שמכם המלא לאישור</label>
              <input
                value={confirmedName}
                onChange={(e) => setConfirmedName(e.target.value)}
                placeholder="הקלידו כאן: שם פרטי ושם משפחה"
              />
            </div>

            <div className="form-group">
              <label>חתימה</label>
              <SignaturePad onChange={setSignatureImage} initialImage={null} />
            </div>

            {(signMutation.isError || error) && (
              <div className="agreement-error">{error || 'החתימה נכשלה, נסו שוב'}</div>
            )}

            {/* The button stays disabled until both are done — say which one is missing */}
            {(() => {
              const missing = [
                ...(confirmedName.trim().length < 2 ? ['להקליד את השם המלא בתיבה למעלה'] : []),
                ...(!signatureImage ? ['לחתום במשבצת'] : []),
              ];
              return missing.length > 0 && !signMutation.isPending ? (
                <div className="signing-missing">כדי לאשר את החתימה צריך {missing.join(' וגם ')}.</div>
              ) : null;
            })()}

            <div className="modal-actions">
              <button onClick={() => { setSigningFor(null); setError(null); }} className="btn-secondary">ביטול</button>
              <button
                onClick={submitSignature}
                className="btn-primary"
                disabled={
                  !signatureImage ||
                  confirmedName.trim().length < 2 ||
                  signMutation.isPending
                }
              >
                {signMutation.isPending ? 'חותם…' : 'אשר וחתום'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Email the parents ---------- */}
      {showEmail && agreement && (() => {
        const results = emailMutation.data?.data?.results;
        const sentAt = agreement.parentEmails || {};
        const rows = parents.map((p) => {
          const signed = !!signatures[signatureSlotKey('parent', p.id)];
          const email = (p.email || '').trim();
          const result = results?.find((r) => r.parentId === p.id);
          return { p, signed, email, result, willSend: !signed && !!email };
        });
        const sendCount = rows.filter((r) => r.willSend).length;
        const anyMissingEmail = rows.some((r) => !r.signed && !r.email);
        return (
          <div className="modal-overlay" onClick={() => setShowEmail(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ direction: 'rtl' }}>
              <h3>שליחת ההסכם להורים במייל</h3>
              <p className="email-intro">
                כל הורה מקבל מייל עם קישור אישי לעיון בהסכם ולחתימה עליו מהטלפון.
              </p>

              <div className="email-parent-list">
                {rows.map(({ p, signed, email, result }) => (
                  <div key={p.id} className="email-parent-row">
                    <div className="email-parent-who">
                      <div className="email-parent-name">{p.name}</div>
                      <div className="email-parent-addr" dir="ltr">{email || 'אין כתובת מייל'}</div>
                    </div>
                    <span className={`email-parent-status ${
                      result ? result.status : signed ? 'signed' : !email ? 'no-email' : 'ready'
                    }`}>
                      {result
                        ? ({ sent: 'נשלח ✓', failed: 'השליחה נכשלה', 'no-email': 'אין מייל', signed: 'כבר חתם/ה' } as const)[result.status]
                        : signed
                          ? 'כבר חתם/ה'
                          : !email
                            ? 'לא יישלח'
                            : sentAt[p.id]
                              ? `נשלח ב־${formatDateTime(sentAt[p.id])}`
                              : 'יישלח'}
                    </span>
                  </div>
                ))}
              </div>

              {anyMissingEmail && !results && (
                <p className="email-hint">
                  להורה בלי מייל אפשר להוסיף כתובת בעמוד הילד (סקירה ← הורים), או לשלוח את הקישור בוואטסאפ.
                </p>
              )}
              <div className="email-share-row">
                <span>או שלחו קישור בעצמכם:</span>
                <button type="button" onClick={copyParentLink} className="btn-secondary btn-small">
                  {copied ? 'הועתק ✓' : '🔗 העתקה'}
                </button>
                <button type="button" onClick={shareOnWhatsApp} className="btn-secondary btn-small btn-whatsapp">
                  וואטסאפ
                </button>
              </div>

              {emailMutation.data && !emailMutation.data.success && (
                <div className="agreement-error">{emailMutation.data.error || 'השליחה נכשלה'}</div>
              )}

              <div className="modal-actions">
                <button onClick={() => setShowEmail(false)} className="btn-secondary">
                  {results ? 'סגירה' : 'ביטול'}
                </button>
                {!results && (
                  <button
                    onClick={() => emailMutation.mutate()}
                    className="btn-primary"
                    disabled={sendCount === 0 || emailMutation.isPending}
                  >
                    {emailMutation.isPending ? 'שולח…' : sendCount === 0 ? 'אין למי לשלוח' : `שליחה (${sendCount})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showDelete && (
        <ConfirmModal
          title="מחיקת ההסכם"
          message="ההסכם יימחק לצמיתות. ניתן למחוק רק הסכם שטרם נחתם."
          confirmText="מחק"
          confirmStyle="danger"
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
