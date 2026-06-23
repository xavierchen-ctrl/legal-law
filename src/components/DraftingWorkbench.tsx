'use client';

import { useState, useCallback } from 'react';
import LoadingModal from './LoadingModal';
import type { DraftResult, RewriteResult } from '@/lib/drafting-service';

// ── Inline types (safe for client — no server imports at runtime) ─────────────

type DocumentType =
    | 'NDA' | 'COOPERATION' | 'AMENDMENT' | 'TERMINATION'
    | 'REPLY_LETTER' | 'COMPANY_LETTER' | 'FORMAL_LETTER' | 'REGISTERED_LETTER'
    | 'COMPLAINT_LETTER' | 'CLAUSE_DRAFT';

type RiskPreference = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

const DOC_TYPES = [
    { id: 'NDA'              as DocumentType, label: '保密協議',  icon: '🔒', desc: 'NDA / 保密合約' },
    { id: 'COOPERATION'      as DocumentType, label: '合作契約',  icon: '🤝', desc: '合作協議書' },
    { id: 'AMENDMENT'        as DocumentType, label: '補充協議',  icon: '📝', desc: '修約 / 補充協議' },
    { id: 'TERMINATION'      as DocumentType, label: '終止協議',  icon: '🚫', desc: '終止 / 解除契約' },
    { id: 'REPLY_LETTER'     as DocumentType, label: '法務回函',  icon: '⚖️', desc: '法務正式回覆函' },
    { id: 'COMPANY_LETTER'   as DocumentType, label: '公司函文',  icon: '🏢', desc: '對外公司函' },
    { id: 'FORMAL_LETTER'    as DocumentType, label: '正式函文',  icon: '📄', desc: '正式對外函文' },
    { id: 'REGISTERED_LETTER'as DocumentType, label: '存證信函',  icon: '📮', desc: '存證信函' },
    { id: 'COMPLAINT_LETTER' as DocumentType, label: '檢舉函',     icon: '🚨', desc: '對主管機關之檢舉函' },
    { id: 'CLAUSE_DRAFT'     as DocumentType, label: '條文起草',  icon: '✍️', desc: '單一條文多版本' },
];

const LETTER_TYPE_SET = new Set<DocumentType>([
    'REPLY_LETTER', 'COMPANY_LETTER', 'FORMAL_LETTER',
    'REGISTERED_LETTER', 'COMPLAINT_LETTER',
]);

const RISK_OPTIONS = [
    { id: 'CONSERVATIVE' as RiskPreference, label: '保守',  desc: '強化己方保護',  active: 'border-blue-400 bg-blue-50 text-blue-800'   },
    { id: 'BALANCED'     as RiskPreference, label: '平衡',  desc: '互惠互利',      active: 'border-green-400 bg-green-50 text-green-800'  },
    { id: 'AGGRESSIVE'   as RiskPreference, label: '積極',  desc: '商業導向',      active: 'border-orange-400 bg-orange-50 text-orange-800'},
];

// ── Clause Library ────────────────────────────────────────────────────────────

interface LibClause { id: string; category: string; title: string; content: string }

const CLAUSE_LIBRARY: LibClause[] = [
    { id: 'conf-def',        category: '保密條款',   title: '機密資訊定義（廣義）',
      content: '本協議所稱「機密資訊」係指乙方因履行本協議或洽談合作而知悉或取得之甲方一切技術、商業、財務、客戶、人事及其他屬於甲方所有或控管之非公開資訊，無論以書面、口頭、電子或任何其他形式揭露者，均屬之。' },
    { id: 'conf-obligation', category: '保密條款',   title: '保密義務',
      content: '乙方應以不低於保護其自身機密資訊之注意程度（且至少應達合理注意程度），對甲方之機密資訊予以保密，未經甲方事先書面同意，不得以任何方式揭露予第三人，或使用於本協議約定目的以外之用途。' },
    { id: 'ip-ownership',   category: '智慧財產權', title: '智慧財產權歸屬（甲方所有）',
      content: '因執行本協議所生之一切著作、發明、創作及其衍生之智慧財產權，除另有書面約定外，均歸甲方所有。乙方應配合辦理相關權利登記或移轉手續，所需費用由甲方負擔。' },
    { id: 'dispute-tw',     category: '爭議解決',   title: '訴訟管轄（臺灣臺北地方法院）',
      content: '本協議之解釋及履行，依中華民國法律定之。因本協議所生之一切爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。' },
    { id: 'dispute-arb',    category: '爭議解決',   title: '仲裁條款（中華民國仲裁協會）',
      content: '因本協議所引起或與本協議有關之一切爭議，應提交中華民國仲裁協會，依該協會之仲裁規則以仲裁方式解決，仲裁地點為臺北市，仲裁語言為中文，仲裁判斷為終局且對雙方具有拘束力。' },
    { id: 'liq-damages',    category: '違約責任',   title: '違約金條款（20%）',
      content: '任一方違反本協議之任何條款時，應通知他方書面限期改正，逾期未改正者，違約方除應賠償他方所受之一切損害外，並應支付相當於本次合作總金額百分之二十（20%）之違約金；如損害超過前述金額，他方得請求全額賠償。' },
    { id: 'force-maj',      category: '不可抗力',   title: '不可抗力條款',
      content: '因不可抗力事由（包括但不限於天災、戰爭、疫情、政府命令或其他不可預見且無法控制之情事）致任一方無法履行本協議義務者，該方應立即通知他方，並於不可抗力情事消滅後盡速恢復履行，且不可抗力期間之遲延不視為違約。' },
    { id: 'termination',    category: '終止條款',   title: '有因終止',
      content: '有下列情事之一者，他方得以書面通知終止本協議：（一）任一方違反本協議重要條款，經書面通知後三十（30）日內未予改正；（二）任一方聲請破產、重整或有解散清算情事；（三）雙方書面合意終止。' },
    { id: 'limit-liab',     category: '責任限制',   title: '責任限制條款',
      content: '任一方對他方所負之賠償責任，以本協議約定之合作總金額為上限，且任何一方均不對他方之間接損害、衍生損害、特殊損害或懲罰性損害負賠償責任，法律強制規定不得排除者不在此限。' },
    { id: 'non-compete',    category: '競業禁止',   title: '競業禁止（1年）',
      content: '乙方於本協議有效期間及終止後一（1）年內，不得直接或間接從事、投資、協助或受僱於與甲方業務相競爭之活動或企業，亦不得以任何方式招攬甲方之客戶或員工。' },
    { id: 'entire-agr',     category: '一般條款',   title: '完整協議條款',
      content: '本協議構成雙方就本協議標的事項之完整合意，並取代雙方先前就相同事項所為之一切口頭或書面協商、承諾及協議。本協議之任何修改，應以雙方書面簽署為之，方生效力。' },
    { id: 'severability',   category: '一般條款',   title: '可分性條款',
      content: '本協議任何條款如被認定為無效或不可執行，該條款應盡可能在最小限度內修正以使其有效；其餘條款之效力不受影響，繼續完全有效。' },
];

const LIBRARY_GROUPED = CLAUSE_LIBRARY.reduce<Record<string, LibClause[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
}, {});

// ── EditState ─────────────────────────────────────────────────────────────────

interface EditState {
    title: string; content: string;
    originalTitle: string; originalContent: string;
    reason: string; isEditing: boolean;
    showRewrite: boolean; rewriteGoal: string; rewriting: boolean;
    pendingRevised?: string; pendingExplanation?: string; pendingRiskNote?: string;
}

// ── TrackChangeView ───────────────────────────────────────────────────────────

function TrackChangeView({ original, revised, reason }: { original: string; revised: string; reason: string }) {
    return (
        <div className="mt-3 space-y-2 text-xs">
            {reason && (
                <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700">
                    <span className="font-semibold">修訂說明：</span>{reason}
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="font-semibold text-red-600 mb-1">原始版本</p>
                    <p className="whitespace-pre-wrap text-red-800 leading-relaxed">{original}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="font-semibold text-green-600 mb-1">修訂版本</p>
                    <p className="whitespace-pre-wrap text-green-800 leading-relaxed">{revised}</p>
                </div>
            </div>
        </div>
    );
}

// ── RewriteSection ────────────────────────────────────────────────────────────

interface RewriteSectionProps {
    clauseId: string; clauseTitle: string; currentContent: string;
    editState: EditState; onUpdateEdit: (id: string, u: Partial<EditState>) => void;
}

function RewriteSection({ clauseId, clauseTitle, currentContent, editState, onUpdateEdit }: RewriteSectionProps) {
    const handleRewrite = async () => {
        if (!editState.rewriteGoal.trim()) return;
        onUpdateEdit(clauseId, { rewriting: true, pendingRevised: undefined });
        try {
            const res = await fetch('/api/contract-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rewriteMode: true,
                    clauseTitle,
                    originalContent: currentContent,
                    rewriteGoal: editState.rewriteGoal,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '改寫失敗');
            const r = data.result as RewriteResult;
            onUpdateEdit(clauseId, { rewriting: false, pendingRevised: r.revised, pendingExplanation: r.changeExplanation, pendingRiskNote: r.riskNote });
        } catch (err: any) {
            onUpdateEdit(clauseId, { rewriting: false });
            alert(err.message);
        }
    };

    const acceptRewrite = () => {
        if (!editState.pendingRevised) return;
        onUpdateEdit(clauseId, {
            content: editState.pendingRevised,
            originalContent: editState.originalContent || currentContent,
            reason: editState.pendingExplanation ?? editState.rewriteGoal,
            pendingRevised: undefined, pendingExplanation: undefined, pendingRiskNote: undefined,
            showRewrite: false,
        });
    };

    return (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-purple-700">AI 改寫條文</p>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={editState.rewriteGoal}
                    onChange={e => onUpdateEdit(clauseId, { rewriteGoal: e.target.value })}
                    placeholder="說明改寫方向（例：加強違約金、改為乙方友善版本）"
                    className="flex-1 text-xs border border-purple-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    onKeyDown={e => { if (e.key === 'Enter') handleRewrite(); }}
                />
                <button
                    onClick={handleRewrite}
                    disabled={editState.rewriting || !editState.rewriteGoal.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors font-semibold whitespace-nowrap"
                >
                    {editState.rewriting ? '改寫中...' : '執行改寫'}
                </button>
            </div>
            {editState.pendingRevised && (
                <div className="space-y-2">
                    <div className="bg-white rounded-lg border border-purple-200 p-3">
                        <p className="text-xs font-semibold text-purple-600 mb-1">改寫結果</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{editState.pendingRevised}</p>
                    </div>
                    {editState.pendingExplanation && (
                        <p className="text-xs text-purple-700 px-1"><span className="font-semibold">說明：</span>{editState.pendingExplanation}</p>
                    )}
                    {editState.pendingRiskNote && (
                        <p className="text-xs text-amber-700 px-1"><span className="font-semibold">風險提示：</span>{editState.pendingRiskNote}</p>
                    )}
                    <div className="flex gap-2">
                        <button onClick={acceptRewrite} className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold">
                            採用此版本
                        </button>
                        <button onClick={() => onUpdateEdit(clauseId, { pendingRevised: undefined })}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                            放棄
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── ClauseCard ────────────────────────────────────────────────────────────────

interface ClauseCardProps {
    clause: DraftResult['clauses'][0];
    editState?: EditState;
    showTrackChanges: boolean;
    isExtra?: boolean;
    onUpdateEdit: (id: string, u: Partial<EditState>) => void;
    onRemove?: () => void;
}

function ClauseCard({ clause, editState, showTrackChanges, isExtra, onUpdateEdit, onRemove }: ClauseCardProps) {
    const [showNote, setShowNote] = useState(false);

    const currentTitle = editState?.title ?? clause.title;
    const currentContent = editState?.content ?? clause.content;
    const isEdited = !!(editState && (editState.title !== editState.originalTitle || editState.content !== editState.originalContent));

    const startEdit = () => onUpdateEdit(clause.id, {
        title: currentTitle, content: currentContent,
        originalTitle: currentTitle, originalContent: currentContent,
        reason: editState?.reason ?? '', isEditing: true,
    });

    const saveEdit = () => onUpdateEdit(clause.id, { isEditing: false });

    const cancelEdit = () => onUpdateEdit(clause.id, {
        title: editState?.originalTitle ?? clause.title,
        content: editState?.originalContent ?? clause.content,
        isEditing: false,
    });

    return (
        <div className={`rounded-xl border bg-white shadow-sm overflow-hidden mb-4 transition-all ${isEdited ? 'border-indigo-300' : 'border-gray-200'}`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${isEdited ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                <span className="text-xs font-bold text-gray-700 flex-1">{currentTitle}</span>
                {isEdited && <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium">已修訂</span>}
                {isExtra && <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 font-medium">條款庫</span>}
                {clause.draftNote && (
                    <button onClick={() => setShowNote(v => !v)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-300 transition-colors">
                        {showNote ? '▼' : '▶'} 起草說明
                    </button>
                )}
                {isExtra && onRemove && (
                    <button onClick={onRemove} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors">✕</button>
                )}
            </div>

            {showNote && clause.draftNote && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                    <span className="font-semibold">起草說明：</span>{clause.draftNote}
                </div>
            )}

            <div className="px-4 py-3">
                {editState?.isEditing ? (
                    <div className="space-y-2">
                        <input type="text" value={editState.title}
                            onChange={e => onUpdateEdit(clause.id, { title: e.target.value })}
                            className="w-full text-xs font-semibold border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            placeholder="條文標題" />
                        <textarea value={editState.content} rows={6}
                            onChange={e => onUpdateEdit(clause.id, { content: e.target.value })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed" />
                        <input type="text" value={editState.reason}
                            onChange={e => onUpdateEdit(clause.id, { reason: e.target.value })}
                            placeholder="修訂原因說明（選填）"
                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-300 text-gray-600" />
                        <div className="flex gap-2">
                            <button onClick={saveEdit} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">儲存</button>
                            <button onClick={cancelEdit} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">取消</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{currentContent}</p>

                        {showTrackChanges && isEdited && (
                            <TrackChangeView
                                original={editState!.originalContent}
                                revised={editState!.content}
                                reason={editState!.reason}
                            />
                        )}

                        {editState?.showRewrite && (
                            <RewriteSection
                                clauseId={clause.id} clauseTitle={currentTitle}
                                currentContent={currentContent} editState={editState}
                                onUpdateEdit={onUpdateEdit}
                            />
                        )}

                        <div className="flex gap-2 mt-3 flex-wrap">
                            <button onClick={startEdit}
                                className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                ✏️ 手動編輯
                            </button>
                            <button
                                onClick={() => onUpdateEdit(clause.id, { showRewrite: !editState?.showRewrite })}
                                className={`text-xs px-2.5 py-1 rounded border transition-colors ${editState?.showRewrite ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                🤖 AI 改寫
                            </button>
                            {isEdited && (
                                <button
                                    onClick={() => onUpdateEdit(clause.id, { title: clause.title, content: clause.content, reason: '' })}
                                    className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                                    ↩ 還原
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── LibraryDrawer ─────────────────────────────────────────────────────────────

function LibraryDrawer({ onInsert, onClose }: { onInsert: (c: LibClause) => void; onClose: () => void }) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [inserted, setInserted] = useState<string | null>(null);

    return (
        <div className="rounded-xl border border-violet-200 bg-violet-50/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-violet-200">
                <div className="flex items-center gap-2">
                    <span>📚</span>
                    <span className="text-sm font-semibold text-violet-800">公版條款庫</span>
                    <span className="text-xs text-gray-400">點擊條款可加入文件末尾</span>
                </div>
                <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">收起 ▲</button>
            </div>
            <div className="divide-y divide-violet-100">
                {Object.entries(LIBRARY_GROUPED).map(([cat, items]) => (
                    <div key={cat}>
                        <button
                            onClick={() => setExpanded(v => v === cat ? null : cat)}
                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 transition-colors text-left">
                            <span className="text-xs font-semibold text-violet-700">{cat}</span>
                            <span className="text-gray-400 text-xs">{expanded === cat ? '▼' : '▶'}</span>
                        </button>
                        {expanded === cat && (
                            <div className="px-4 pb-3 space-y-2">
                                {items.map(item => (
                                    <div key={item.id} className="rounded-lg bg-white border border-violet-100 p-3 text-xs space-y-1.5">
                                        <p className="font-semibold text-gray-700">{item.title}</p>
                                        <p className="text-gray-500 leading-relaxed line-clamp-2">{item.content}</p>
                                        <button
                                            onClick={() => { onInsert(item); setInserted(item.id); setTimeout(() => setInserted(null), 1500); }}
                                            className={`text-xs px-2 py-1 rounded border transition-colors font-medium ${inserted === item.id ? 'border-green-300 bg-green-50 text-green-700' : 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
                                            {inserted === item.id ? '✅ 已新增' : '+ 加入文件'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Workbench ────────────────────────────────────────────────────────────

interface ReferenceDoc { name: string; text: string; charCount: number }

export default function DraftingWorkbench() {
    const [docType, setDocType] = useState<DocumentType>('NDA');
    const [partyA, setPartyA] = useState('');
    const [partyB, setPartyB] = useState('');
    const [caseBackground, setCaseBackground] = useState('');
    const [businessModel, setBusinessModel] = useState('');
    const [companyPosition, setCompanyPosition] = useState('');
    const [riskPreference, setRiskPreference] = useState<RiskPreference>('BALANCED');
    const [additionalNotes, setAdditionalNotes] = useState('');
    // 函文／檢舉函類專用欄位
    const [recipient, setRecipient] = useState('');
    const [sender, setSender] = useState('');
    const [factSummary, setFactSummary] = useState('');
    const [claim, setClaim] = useState('');
    const [legalBasis, setLegalBasis] = useState('');
    const [deadlineAndConsequence, setDeadlineAndConsequence] = useState('');
    const [incomingLetterRef, setIncomingLetterRef] = useState('');
    const [incomingLetterSummary, setIncomingLetterSummary] = useState('');
    const [subjectOfComplaint, setSubjectOfComplaint] = useState('');
    const [allegedViolations, setAllegedViolations] = useState('');
    // 參考資料
    const [refDocs, setRefDocs] = useState<ReferenceDoc[]>([]);
    const [refUploading, setRefUploading] = useState(false);
    const [refUploadError, setRefUploadError] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DraftResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [edits, setEdits] = useState<Record<string, EditState>>({});
    const [showTrackChanges, setShowTrackChanges] = useState(true);
    const [formCollapsed, setFormCollapsed] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [extraClauses, setExtraClauses] = useState<DraftResult['clauses']>([]);

    const isLetterType = LETTER_TYPE_SET.has(docType);
    const isComplaintType = docType === 'COMPLAINT_LETTER';
    const isReplyLetter = docType === 'REPLY_LETTER';

    const canSubmit = isLetterType
        ? (factSummary.trim().length >= 20 || caseBackground.trim().length >= 20 || refDocs.length > 0)
        : (caseBackground.trim().length >= 10 && businessModel.trim().length >= 5 && companyPosition.trim().length >= 5);

    const handleUploadRef = async (file: File) => {
        setRefUploadError(null);
        if (file.size > 4 * 1024 * 1024) {
            setRefUploadError(`📁 檔案太大（${(file.size / 1024 / 1024).toFixed(1)} MB），上限 4 MB`);
            return;
        }
        setRefUploading(true);
        try {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch('/api/extract-text', { method: 'POST', body: form });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '解析失敗');
            setRefDocs(prev => [...prev, { name: file.name, text: data.text, charCount: data.charCount ?? data.text.length }]);
        } catch (err: any) {
            setRefUploadError(err.message);
        } finally {
            setRefUploading(false);
        }
    };

    const removeRef = (idx: number) => setRefDocs(prev => prev.filter((_, i) => i !== idx));

    const handleGenerate = async () => {
        // Preflight：函文類事實過短時提醒
        if (isLetterType) {
            const factLen = factSummary.trim().length + caseBackground.trim().length;
            if (factLen < 80 && refDocs.length === 0) {
                const ok = window.confirm(
                    `您提供的案件事實少於 80 字，且未上傳參考資料。\n\n` +
                    `為避免 AI 自行推論與案件無關之情節（例如錯誤的事件背景），建議先補充：\n` +
                    `• 具體時間、地點、人物\n` +
                    `• 對方行為內容\n` +
                    `• 您的請求事項\n` +
                    `• 或上傳相關附件作為事實依據\n\n` +
                    `是否仍要繼續產生草稿？\n（系統將以「[待補：xxx]」標示缺漏處，不會憑空編造具體細節）`
                );
                if (!ok) return;
            }
        }

        setLoading(true); setError(null); setResult(null); setEdits({}); setExtraClauses([]);
        try {
            const res = await fetch('/api/contract-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentType: docType, caseBackground, businessModel, companyPosition,
                    riskPreference, additionalNotes: additionalNotes || undefined,
                    partyAName: partyA || undefined, partyBName: partyB || undefined,
                    recipient: recipient || undefined,
                    sender: sender || undefined,
                    factSummary: factSummary || undefined,
                    claim: claim || undefined,
                    legalBasis: legalBasis || undefined,
                    deadlineAndConsequence: deadlineAndConsequence || undefined,
                    incomingLetterRef: incomingLetterRef || undefined,
                    incomingLetterSummary: incomingLetterSummary || undefined,
                    subjectOfComplaint: subjectOfComplaint || undefined,
                    allegedViolations: allegedViolations || undefined,
                    referenceDocuments: refDocs.length > 0
                        ? refDocs.map(d => ({ name: d.name, text: d.text }))
                        : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? '起草失敗');
            setResult(data.result);
            setFormCollapsed(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateEdit = useCallback((id: string, updates: Partial<EditState>) => {
        setEdits(prev => {
            const base: EditState = prev[id] ?? {
                title: '', content: '', originalTitle: '', originalContent: '',
                reason: '', isEditing: false, showRewrite: false, rewriteGoal: '', rewriting: false,
            };
            return { ...prev, [id]: { ...base, ...updates } };
        });
    }, []);

    const insertLibraryClause = (clause: LibClause) => {
        setExtraClauses(prev => [...prev, { id: `lib-${Date.now()}`, title: clause.title, content: clause.content, draftNote: '從公版條款庫插入' }]);
    };

    const buildFullDocument = () => {
        if (!result) return '';
        const lines: string[] = [result.documentTitle, ''];
        if (result.parties) { lines.push(`甲方：${result.parties.partyA}`, `乙方：${result.parties.partyB}`, ''); }
        if (result.preamble) { lines.push(result.preamble, ''); }
        [...result.clauses, ...extraClauses].forEach(clause => {
            const e = edits[clause.id];
            lines.push(e?.title ?? clause.title, e?.content ?? clause.content, '');
        });
        if (result.closingTerms) { lines.push(result.closingTerms, ''); }
        lines.push('甲方（簽署）：___________________________    日期：__________');
        lines.push('乙方（簽署）：___________________________    日期：__________');
        return lines.join('\n');
    };

    const copyDocument = async () => {
        try { await navigator.clipboard.writeText(buildFullDocument()); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); } catch {}
    };

    const editedCount = Object.values(edits).filter(e => e.title !== e.originalTitle || e.content !== e.originalContent).length;

    const resetAll = () => { setResult(null); setFormCollapsed(false); setEdits({}); setExtraClauses([]); };

    return (
        <div className="space-y-6">
            <LoadingModal open={loading} title="AI 起草文件中..." message="正在依案件資訊生成法律文件，通常需要 30～60 秒，請稍候" />

            {/* ── Input Form ─────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-gray-100"
                    style={{ cursor: result ? 'pointer' : 'default' }}
                    onClick={() => result && setFormCollapsed(v => !v)}>
                    <div className="flex items-center gap-3">
                        <span className="text-xl">✍️</span>
                        <div>
                            <h2 className="text-base font-bold text-violet-900">文件起草條件</h2>
                            <p className="text-xs text-violet-500">填寫案件資訊，AI 將依此起草法律文件</p>
                        </div>
                    </div>
                    {result && (
                        <span className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 bg-white">
                            {formCollapsed ? '▼ 展開修改' : '▲ 收起'}
                        </span>
                    )}
                </div>

                {!formCollapsed && (
                    <div className="p-6 space-y-6">
                        {/* Document Type */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">文件類型 <span className="text-red-400">*</span></label>
                            <div className="flex flex-wrap gap-2">
                                {DOC_TYPES.map(t => (
                                    <button key={t.id} onClick={() => setDocType(t.id)} title={t.desc}
                                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${docType === t.id ? 'border-violet-400 bg-violet-50 text-violet-800 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                                        <span>{t.icon}</span><span>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Party Names */}
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { label: '甲方名稱（選填）', val: partyA, set: setPartyA, ph: '例：WaveNet 股份有限公司' },
                                { label: '乙方名稱（選填）', val: partyB, set: setPartyB, ph: '例：相對人股份有限公司' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{f.label}</label>
                                    <input type="text" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all" />
                                </div>
                            ))}
                        </div>

                        {/* 主要欄位：契約類與函文類動態顯示 */}
                        {!isLetterType ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { label: '案件背景', val: caseBackground, set: setCaseBackground, ph: '說明案件或合作背景，例如：雙方擬就 AI 技術開發進行合作，需先簽署保密協議以保護技術資訊...', req: true },
                                    { label: '商務模式', val: businessModel, set: setBusinessModel, ph: '說明商業模式或合作架構，例如：技術授權合作、聯合開發、供應鏈採購、勞務委外...', req: true },
                                    { label: '公司立場', val: companyPosition, set: setCompanyPosition, ph: '說明公司在此案件中的立場與目標，例如：希望加強智財保護、避免競業風險、確保對方履約...', req: true },
                                ].map(f => (
                                    <div key={f.label}>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                            {f.label} {f.req && <span className="text-red-400">*</span>}
                                        </label>
                                        <textarea value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} rows={5}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all text-gray-800 placeholder-gray-400" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-violet-700 leading-relaxed">
                                    📋 {isComplaintType ? '檢舉函' : '函文'}結構欄位：請逐項填寫，AI 將依此撰擬。
                                    缺漏處系統會以「[待補：xxx]」標示，<span className="font-semibold">不會自行推論未提供之具體事實</span>。
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                            {isComplaintType ? '受理機關／收件對象' : '收件對象'}
                                        </label>
                                        <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)}
                                            placeholder={isComplaintType ? '例：公平交易委員會' : '例：XX 股份有限公司 法務部'}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                            {isComplaintType ? '檢舉人' : '寄件人'}
                                        </label>
                                        <input type="text" value={sender} onChange={e => setSender(e.target.value)}
                                            placeholder={isComplaintType ? '例：WaveNet 股份有限公司' : '例：本公司 法務部'}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                    </div>
                                </div>

                                {isComplaintType && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">被檢舉對象</label>
                                            <input type="text" value={subjectOfComplaint} onChange={e => setSubjectOfComplaint(e.target.value)}
                                                placeholder="例：XX 股份有限公司 / 行為人姓名"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">涉嫌違反法令</label>
                                            <input type="text" value={allegedViolations} onChange={e => setAllegedViolations(e.target.value)}
                                                placeholder="例：公平交易法第X條、消費者保護法第Y條"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                        </div>
                                    </div>
                                )}

                                {isReplyLetter && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">對方來函日期／字號</label>
                                            <input type="text" value={incomingLetterRef} onChange={e => setIncomingLetterRef(e.target.value)}
                                                placeholder="例：114.06.15 收文字號 XX字第123號"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">來函要旨</label>
                                            <input type="text" value={incomingLetterSummary} onChange={e => setIncomingLetterSummary(e.target.value)}
                                                placeholder="例：要求我方就 XX 事項說明"
                                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                                        案件事實 <span className="text-red-400">*</span>
                                        <span className="ml-1 font-normal text-gray-400">（請具體：時間、人物、事件、地點）</span>
                                    </label>
                                    <textarea value={factSummary} onChange={e => setFactSummary(e.target.value)} rows={5}
                                        placeholder={isComplaintType
                                            ? '請具體陳述：何時、何地、被檢舉人之何種行為，以及為何認為違法。\n例：「於 114 年 5 月 1 日，被檢舉人於其官網以『市場唯一』之詞行不實廣告，致消費者誤認...」'
                                            : '請具體陳述本案事實。\n例：「雙方於 114 年 3 月 1 日簽訂合作契約，相對人未依約於 114 年 5 月 31 日前完成交付...」'}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-400" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">主張／請求事項</label>
                                        <textarea value={claim} onChange={e => setClaim(e.target.value)} rows={3}
                                            placeholder={isComplaintType
                                                ? '例：懇請貴會依法調查並予以裁處'
                                                : '例：請於文到 7 日內完成交付並支付遲延損害金 XX 元'}
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-400" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">期限與後果</label>
                                        <textarea value={deadlineAndConsequence} onChange={e => setDeadlineAndConsequence(e.target.value)} rows={3}
                                            placeholder="例：請於文到 14 日內函覆，逾期將循法律途徑追究..."
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-400" />
                                    </div>
                                </div>

                                {!isComplaintType && (
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">法律依據</label>
                                        <input type="text" value={legalBasis} onChange={e => setLegalBasis(e.target.value)}
                                            placeholder="例：違反契約第 5 條、民法第 226 條"
                                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 參考資料上傳 */}
                        <div className="rounded-xl border border-violet-200 bg-violet-50/30 px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <p className="text-xs font-bold text-violet-800">📎 參考資料／附件上傳</p>
                                    <p className="text-xs text-violet-600 mt-0.5">支援 PDF / DOCX / TXT，上限 4 MB。AI 將以實際文件內容為基礎撰擬，避免推論虛構情節。</p>
                                </div>
                                <label className="cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 font-semibold transition-colors">
                                    {refUploading ? '解析中...' : '+ 上傳檔案'}
                                    <input type="file" accept=".pdf,.docx,.txt" className="hidden" disabled={refUploading}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadRef(f); e.target.value = ''; }} />
                                </label>
                            </div>
                            {refUploadError && <p className="text-xs text-red-500">{refUploadError}</p>}
                            {refDocs.length > 0 && (
                                <ul className="space-y-1 mt-2">
                                    {refDocs.map((d, i) => (
                                        <li key={i} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white border border-violet-200 text-xs">
                                            <span className="text-violet-600">📄</span>
                                            <span className="font-medium text-gray-800 flex-1 truncate">{d.name}</span>
                                            <span className="text-gray-400">{d.charCount.toLocaleString()} 字元</span>
                                            <button onClick={() => removeRef(i)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Risk Preference */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">風險偏好 <span className="text-red-400">*</span></label>
                            <div className="flex gap-3">
                                {RISK_OPTIONS.map(opt => (
                                    <button key={opt.id} onClick={() => setRiskPreference(opt.id)}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${riskPreference === opt.id ? opt.active + ' border-current shadow-sm' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}>
                                        <div>{opt.label}</div>
                                        <div className={`text-xs font-normal mt-0.5 ${riskPreference === opt.id ? 'opacity-80' : 'text-gray-400'}`}>{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Additional Notes */}
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">補充說明（選填）</label>
                            <textarea value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)}
                                placeholder="其他需特別考量的事項，例如：需加入特定條款、排除某些限制、注意特定監管要求..."
                                rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 resize-y focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all text-gray-800 placeholder-gray-400" />
                        </div>

                        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">⚠️ {error}</div>}

                        <button onClick={handleGenerate} disabled={loading || !canSubmit}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-200 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg">
                            {loading ? (
                                <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> AI 起草中...</>
                            ) : '✍️ 產生法律文件草稿'}
                        </button>
                    </div>
                )}
            </div>

            {/* ── Result ─────────────────────────────────────────────────── */}
            {result && (
                <div className="space-y-4">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-3 px-1">
                        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                            <span>📄</span>{result.documentTitle}
                        </h2>
                        <div className="ml-auto flex items-center gap-2 flex-wrap">
                            {editedCount > 0 && (
                                <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">{editedCount} 條已修訂</span>
                            )}
                            <button onClick={() => setShowTrackChanges(v => !v)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${showTrackChanges ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                {showTrackChanges ? '🔍 Track Changes 開啟' : '○ Track Changes 關閉'}
                            </button>
                            <button onClick={() => setShowLibrary(v => !v)}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${showLibrary ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                📚 條款庫
                            </button>
                            <button onClick={copyDocument}
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${copySuccess ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                {copySuccess ? '✅ 已複製' : '📋 複製全文'}
                            </button>
                            <button onClick={resetAll} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors font-medium">
                                ↺ 重新起草
                            </button>
                        </div>
                    </div>

                    {/* Clause Library */}
                    {showLibrary && <LibraryDrawer onInsert={insertLibraryClause} onClose={() => setShowLibrary(false)} />}

                    {/* Summary & Risk Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                            <p className="text-xs font-bold text-green-700 mb-1">起草說明</p>
                            <p className="text-xs text-green-800 leading-relaxed">{result.draftSummary}</p>
                        </div>
                        {result.riskNotes && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="text-xs font-bold text-amber-700 mb-1">⚠️ 風險提示</p>
                                <p className="text-xs text-amber-800 leading-relaxed">{result.riskNotes}</p>
                            </div>
                        )}
                    </div>

                    {/* Parties */}
                    {result.parties && (
                        <div className="flex gap-4 text-sm text-gray-700 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <span><strong>甲方：</strong>{result.parties.partyA}</span>
                            <span className="text-gray-300">｜</span>
                            <span><strong>乙方：</strong>{result.parties.partyB}</span>
                        </div>
                    )}

                    {/* Preamble */}
                    {result.preamble && (
                        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">前言</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.preamble}</p>
                        </div>
                    )}

                    {/* Clause Cards */}
                    {[...result.clauses, ...extraClauses].map(clause => {
                        const isExtra = extraClauses.some(c => c.id === clause.id);
                        return (
                            <ClauseCard key={clause.id} clause={clause}
                                editState={edits[clause.id]} showTrackChanges={showTrackChanges}
                                isExtra={isExtra} onUpdateEdit={updateEdit}
                                onRemove={isExtra ? () => setExtraClauses(p => p.filter(c => c.id !== clause.id)) : undefined}
                            />
                        );
                    })}

                    {/* Closing Terms */}
                    {result.closingTerms && (
                        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 shadow-sm">
                            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">附則 / 簽署</p>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{result.closingTerms}</p>
                        </div>
                    )}

                    {/* Signature Block */}
                    <div className="bg-white rounded-xl border border-dashed border-gray-300 px-6 py-6 shadow-sm">
                        <div className="grid grid-cols-2 gap-12 text-sm text-gray-600">
                            {['甲方', '乙方'].map(p => (
                                <div key={p} className="space-y-5">
                                    <p className="font-semibold text-gray-400 text-xs uppercase tracking-wider">{p}</p>
                                    <div className="border-b border-gray-400 pb-1">簽署：___________________________</div>
                                    <div className="border-b border-gray-400 pb-1">日期：__________</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom actions */}
                    <div className="flex justify-center gap-4 pt-2 pb-6">
                        <button onClick={copyDocument}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all ${copySuccess ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'}`}>
                            {copySuccess ? '✅ 已複製全文' : '📋 複製全文'}
                        </button>
                        <button onClick={resetAll}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all">
                            ✍️ 重新起草
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
