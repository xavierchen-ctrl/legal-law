import Link from 'next/link';
import { differenceInCalendarDays, addBusinessDays, isValid } from 'date-fns';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import ContractsTable, { EnrichedContract } from '@/components/ContractsTable';
import FilterBar from '@/components/FilterBar';

export const dynamic = 'force-dynamic';

export default async function Dashboard(props: { searchParams?: Promise<{ showAll?: string, q?: string, dept?: string, urgent?: string }> }) {
  const searchParams = await props.searchParams;
  const showAll = searchParams?.showAll === 'true';
  const query = searchParams?.q?.toLowerCase() || '';
  const deptFilter = searchParams?.dept?.toLowerCase() || '';
  const isUrgentOnly = searchParams?.urgent === 'true';

  const contracts = await fetchContractsFromSheet();

  const today = new Date();

  // Process data on server to ensure consistency
  const enrichedContracts: EnrichedContract[] = contracts.map(contract => {
    // 1. Calculate Deadline
    let deadline: Date | null = null;
    const reqDate = new Date(contract.requestDate);

    if (isValid(reqDate)) {
      const daysToAdd = contract.priority === 'URGENT' ? 3 : 5;
      deadline = addBusinessDays(reqDate, daysToAdd);
    } else if (contract.estimatedReplyDate) {
      const est = new Date(contract.estimatedReplyDate);
      if (isValid(est)) deadline = est;
    }

    // 2. Calculate Overdue Status
    let overdueDays = 0;
    let isOverdue = false;
    const isLegalPending = contract.status === 'SUBMITTED' || contract.status === 'IN_REVIEW';

    // Legacy Filter logic embedded in map for efficiency... 
    // Actually cleaner to do it in the filtering step, 
    // but the `isLegacy` flag is useful for the individual contract object if we ever want to show it.
    const contractNumStr = contract.contractNumber.replace(/\D/g, '');
    const contractNumVal = parseInt(contractNumStr, 10);
    const legacyCutoff = 250056;
    const isLegacy = !isNaN(contractNumVal) && contractNumVal < legacyCutoff;

    if (!isLegacy && isLegalPending && deadline) {
      overdueDays = differenceInCalendarDays(today, deadline);
      if (contract.priority === 'URGENT' && overdueDays > 1) isOverdue = true;
      if (contract.priority === 'NORMAL' && overdueDays > 3) isOverdue = true;
    }

    // 3. Post-Review Tracking (NEW)
    let postReviewDays = 0;
    let isPostReviewOverdue = false;

    // Only check post-review if not closed and legacy check passes
    if (!isLegacy && contract.status !== 'CLOSED' && contract.lastReplyDate) {
      const replyDate = new Date(contract.lastReplyDate);
      if (isValid(replyDate)) {
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
    const isLegacy = !isNaN(contractNumVal) && contractNumVal < 250056;
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

    return true;
  });

  const legacyCount = enrichedContracts.filter(c => {
    if (!c.requestDate || c.requestDate.trim() === '') return false;
    const contractNumStr = c.contractNumber.replace(/\D/g, '');
    const contractNumVal = parseInt(contractNumStr, 10);
    return !isNaN(contractNumVal) && contractNumVal < 250056;
  }).length;

  // Calculate Stats based on DISPLAYED contracts
  const activeContracts = displayedContracts.filter(c => c.status !== 'CLOSED');
  const urgentCount = activeContracts.filter(c => c.priority === 'URGENT').length;
  const overdueCount = activeContracts.filter(c => c.isOverdue).length;
  const postReviewOverdueCount = activeContracts.filter(c => c.isPostReviewOverdue).length;

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
        <div className="flex gap-4">
          <Link href="/api/notification/check-overdue" target="_blank" className="btn" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
            檢查逾期 (手動觸發)
          </Link>
          <a href="https://docs.google.com/spreadsheets/d/1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE/edit" target="_blank" className="btn btn-primary">
            前往試算表作業
          </a>
          <Link href="/admin/logs" className="btn bg-gray-100 hover:bg-gray-200 text-gray-700">
            系統日誌
          </Link>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-blue-600">{activeContracts.length}</span>
          <span className="text-gray-500 mt-2">進行中案件</span>
        </div>
        <div className="card glass-panel flex flex-col items-center justify-center p-6">
          <span className="text-4xl font-bold text-purple-600">{urgentCount}</span>
          <span className="text-gray-500 mt-2">急件</span>
        </div>
        <div className={`card glass-panel flex flex-col items-center justify-center p-6 ${overdueCount > 0 ? 'border-red-500 bg-red-50' : ''}`}>
          <span className={`text-4xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {overdueCount}
          </span>
          <span className="text-gray-500 mt-2">審閱逾期</span>
        </div>
        <div className={`card glass-panel flex flex-col items-center justify-center p-6 ${postReviewOverdueCount > 0 ? 'border-orange-500 bg-orange-50' : ''}`}>
          <span className={`text-4xl font-bold ${postReviewOverdueCount > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
            {postReviewOverdueCount}
          </span>
          <span className="text-gray-500 mt-2">未結案逾期</span>
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
