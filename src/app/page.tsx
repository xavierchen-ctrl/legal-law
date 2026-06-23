import Link from 'next/link';
import { differenceInCalendarDays, addBusinessDays, isValid } from 'date-fns';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import ContractsTable, { EnrichedContract } from '@/components/ContractsTable';
import FilterBar from '@/components/FilterBar';
import ManualScanButton from '@/components/ManualScanButton';
import { parseSheetDate } from '@/lib/date-utils';
import GcisModalButton from '@/components/GcisModalButton';

export const dynamic = 'force-dynamic';

export default async function Dashboard(props: { searchParams?: Promise<{ showAll?: string, q?: string, dept?: string, urgent?: string, sort?: string, status?: string, dateFrom?: string, dateTo?: string, replyFrom?: string, replyTo?: string }> }) {
  const searchParams = await props.searchParams;
  const showAll = searchParams?.showAll === 'true';
  const query = searchParams?.q?.toLowerCase() || '';
  const deptFilter = searchParams?.dept?.toLowerCase() || '';
  const isUrgentOnly = searchParams?.urgent === 'true';
  const sortOrder = searchParams?.sort === 'oldest' ? 'oldest' : 'newest';
  const statusFilter = searchParams?.status || '';
  const dateFrom = searchParams?.dateFrom || '';
  const dateTo = searchParams?.dateTo || '';
  const replyFrom = searchParams?.replyFrom || '';
  const replyTo = searchParams?.replyTo || '';

  const contracts = await fetchContractsFromSheet();

  const today = new Date();

  // Process data on server to ensure consistency
  const enrichedContracts: EnrichedContract[] = contracts.map(contract => {


    // ...

    // 1. Calculate Deadline
    let deadline: Date | null = null;
    const reqDate = parseSheetDate(contract.requestDate);

    if (reqDate) {
      const daysToAdd = contract.priority === 'URGENT' ? 3 : 5;
      deadline = addBusinessDays(reqDate, daysToAdd);
    } else if (contract.estimatedReplyDate) {
      const est = parseSheetDate(contract.estimatedReplyDate);
      if (est) deadline = est;
    }

    // 2. Calculate Overdue Status
    let overdueDays = 0;
    let isOverdue = false;
    const isLegalPending = contract.status === 'SUBMITTED' || contract.status === 'IN_REVIEW';

    // Legacy Filter logic embedded in map for efficiency... 
    const contractNumStr = contract.contractNumber.replace(/\D/g, '');
    const contractNumVal = parseInt(contractNumStr, 10);
    const legacyCutoff = 250056;

    // CRITICAL FIX: Treat NaN (no numbers) as Legacy/Invalid so they are excluded from active stats
    const isLegacy = isNaN(contractNumVal) || contractNumVal < legacyCutoff;

    // 2. Calculate Overdue Status
    // FIX (Synced with Notification Logic): If Legal has already replied (lastReplyDate exists),
    // it is NO LONGER considered "Review Overdue", regardless of the deadline.
    // It moves to "Post-Review" tracking instead.
    if (!isLegacy && isLegalPending && deadline && !contract.lastReplyDate) {
      overdueDays = differenceInCalendarDays(today, deadline);
      if (contract.priority === 'URGENT' && overdueDays > 1) isOverdue = true;
      if (contract.priority === 'NORMAL' && overdueDays > 3) isOverdue = true;
    }

    // 3. Post-Review Tracking (NEW)
    let postReviewDays = 0;
    let isPostReviewOverdue = false;

    // Only check post-review if not closed and legacy check passes
    if (!isLegacy && contract.status !== 'CLOSED' && contract.lastReplyDate) {
      const replyDate = parseSheetDate(contract.lastReplyDate);
      if (replyDate) {
        postReviewDays = differenceInCalendarDays(today, replyDate);
        if (postReviewDays > 14) isPostReviewOverdue = true;
      }
    }

    // 4. Format Display
    const deadlineDisplay = deadline
      ? deadline.toLocaleDateString()
      : (contract.estimatedReplyDate || '-');

    return {
      ...contract,
      isOverdue,
      overdueDays,
      deadlineDisplay,
      lastReplyDate: contract.lastReplyDate,
      postReviewDays,
      isPostReviewOverdue
    };
  });

  // --- Filtering Logic ---
  const displayedContracts = enrichedContracts.filter(c => {
    // 1. Placeholder Check
    if (!c.requestDate || c.requestDate.trim() === '') return false;

    // 2. Legacy Check
    const contractNumStr = c.contractNumber.replace(/\D/g, '');
    const contractNumVal = parseInt(contractNumStr, 10);
    const isLegacy = isNaN(contractNumVal) || contractNumVal < 250056;
    if (isLegacy && !showAll) return false;

    // 3. Search Query (Keyword)
    if (query) {
      const text = `${c.contractNumber} ${c.documentName} ${c.counterparty} ${c.requester}`.toLowerCase();
      if (!text.includes(query)) return false;
    }

    // 4. Department Filter
    if (deptFilter) {
      if (!c.department?.toLowerCase().includes(deptFilter)) return false;
    }

    // 5. Urgent Only
    if (isUrgentOnly) {
      if (c.priority !== 'URGENT') return false;
    }

    // 6. Status Filter
    if (statusFilter) {
      if (statusFilter === 'PENDING_STAMP') {
        if (!(c.status === 'PENDING_STAMP' || c.stampInProgress)) return false;
      } else if (statusFilter === 'CLOSED') {
        if (!c.isArchived) return false;
      } else {
        if (c.status !== statusFilter) return false;
      }
    }

    // 7. Request Date Range
    if (dateFrom) {
      const d = parseSheetDate(c.requestDate);
      if (!d || d < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const d = parseSheetDate(c.requestDate);
      if (!d || d > new Date(dateTo + 'T23:59:59')) return false;
    }

    // 8. Estimated Reply Date Range
    if (replyFrom) {
      const d = c.estimatedReplyDate ? parseSheetDate(c.estimatedReplyDate) : null;
      if (!d || d < new Date(replyFrom)) return false;
    }
    if (replyTo) {
      const d = c.estimatedReplyDate ? parseSheetDate(c.estimatedReplyDate) : null;
      if (!d || d > new Date(replyTo + 'T23:59:59')) return false;
    }

    return true;
  }).sort((a, b) => {
    const dateA = parseSheetDate(a.requestDate)?.getTime() ?? 0;
    const dateB = parseSheetDate(b.requestDate)?.getTime() ?? 0;
    return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  const legacyCount = enrichedContracts.filter(c => {
    if (!c.requestDate || c.requestDate.trim() === '') return false;
    const contractNumStr = c.contractNumber.replace(/\D/g, '');
    const contractNumVal = parseInt(contractNumStr, 10);
    // Treat NaN as Legecy/Invalid
    return isNaN(contractNumVal) || contractNumVal < 250056;
  }).length;

  // Calculate Stats based on DISPLAYED contracts
  const activeContracts = displayedContracts.filter(c => c.status !== 'CLOSED');
  const urgentCount = activeContracts.filter(c => c.priority === 'URGENT').length;
  const overdueCount = activeContracts.filter(c => c.isOverdue).length;
  const postReviewOverdueCount = activeContracts.filter(c => c.isPostReviewOverdue).length;

  // Status breakdown stats
  const inReviewCount = displayedContracts.filter(c => c.status === 'IN_REVIEW').length;
  const repliedCount = displayedContracts.filter(c => c.status === 'AWAITING_FEEDBACK').length;
  const pendingStampCount = displayedContracts.filter(c => c.status === 'PENDING_STAMP' || c.stampInProgress).length;
  const closedCount = displayedContracts.filter(c => c.isArchived).length;

  return (
    <main className="container">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Legal Flow (Sync Mode)
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-gray-500">同步自 Google 試算表</p>
            {!showAll && legacyCount > 0 && (
              <Link href="/?showAll=true" className="text-xs text-blue-500 hover:text-blue-700 underline decoration-dotted ml-2">
                (已隱藏 {legacyCount} 筆歷史案件，點此顯示)
              </Link>
            )}
            {showAll && (
              <Link href="/" className="text-xs text-gray-500 hover:text-blue-700 underline decoration-dotted ml-2">
                (點此隱藏歷史案件)
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <GcisModalButton />
          {/* <ManualScanButton /> Hidden for hotfix */}
          <a href="https://docs.google.com/spreadsheets/d/1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE/edit" target="_blank" className="btn btn-primary">
            前往試算表作業
          </a>
          <div className="flex gap-4">
            <Link href="/drafting" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 font-bold text-violet-600">
              <span>✍️</span> 文件撰擬
            </Link>
            <Link href="/admin/logs" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              <span>📋</span> 系統日誌
            </Link>
            <Link href="/admin/keywords" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              <span>🔍</span> 關鍵字/AI 監控
            </Link>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-blue-600">{inReviewCount}</span>
          <span className="text-gray-500 mt-2">審閱中</span>
        </div>
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-indigo-600">{repliedCount}</span>
          <span className="text-gray-500 mt-2">已回覆</span>
        </div>
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-amber-500">{pendingStampCount}</span>
          <span className="text-gray-500 mt-2">待用印</span>
        </div>
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-green-600">{closedCount}</span>
          <span className="text-gray-500 mt-2">已歸檔</span>
        </div>
      </div>

      {/* Contracts Table Component */}
      <ContractsTable contracts={displayedContracts} />

      {!showAll && legacyCount > 0 && (
        <div className="mt-4 text-center">
          <Link href="/?showAll=true" className="text-xs text-gray-400 hover:text-blue-500 underline decoration-dotted transition-colors">
            已隱藏 {legacyCount} 筆 Sandy 時期的歷史案件 (點擊查看)
          </Link>
        </div>
      )}

      {showAll && (
        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-blue-500 hover:text-blue-700 underline decoration-dotted transition-colors">
            隱藏歷史案件，僅顯示目前進度
          </Link>
        </div>
      )}
    </main>
  );
}
