
require('dotenv').config();

async function debugContractStatus() {
    console.log('--- Debugging Contract Status and Overdue Logic ---');

    // 1. Setup Auth & Clients
    const { google } = require('googleapis');
    const { JWT } = require('google-auth-library');
    // Date Fns for Calculation
    const { differenceInCalendarDays, addBusinessDays, isValid } = require('date-fns');

    const client = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth: client });
    const csvUrl = process.env.SHEET_CSV_URL;
    const spreadsheetId = csvUrl.match(/\/d\/(.*?)(\/|$)/)[1];

    // 2. Fetch Data
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = meta.data.sheets[0].properties.title;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:Z` });
    const rows = response.data.values;

    // 3. Header Detection
    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
        // Robust Header Check: matches '合約編號 ' or '合約編號'
        if (rows[i] && rows[i].some(cell => cell && cell.includes('合約編號'))) {
            headerRowIndex = i;
            break;
        }
    }

    const headers = rows[headerRowIndex].map(h => h.trim());
    console.log('Headers Found:', headers);
    const dataRows = rows.slice(headerRowIndex + 1);
    const getValue = (row, partial) => {
        const idx = headers.findIndex(h => h.includes(partial));
        return idx === -1 ? '' : (row[idx] || '').trim(); // Added trim here
    };

    // 4. Transform & Stats
    let total = 0;
    let reviewOverdueCount = 0;
    let postReviewOverdueCount = 0;

    const sampleReviewOverdue = [];
    const samplePostOverdue = [];

    const today = new Date(); // Use system time

    dataRows.forEach((row, idx) => {
        // --- Logic Mirroring google-sheets.ts ---
        const cNum = getValue(row, '合約編號') || getValue(row, '取單號');
        const docName = getValue(row, '文件名稱');
        if (!cNum && !docName) return; // Ghost Row Filter

        total++;
        const contractNumber = cNum || `UNKNOWN-${idx}`;
        const statusRaw = getValue(row, '審閱進度');

        let status = 'SUBMITTED';
        if (statusRaw.includes('已結案') || statusRaw.includes('完成') || statusRaw.includes('結案')) status = 'CLOSED';
        else if (statusRaw.includes('暫停')) status = 'PAUSED';
        else if (statusRaw.includes('待回覆') || statusRaw.includes('待需求單位回覆')) status = 'AWAITING_FEEDBACK';
        else if (statusRaw.includes('審閱中')) status = 'IN_REVIEW';

        const requestDateStr = getValue(row, '申請日期');
        const estDateStr = getValue(row, '預計回覆日');
        const priorityStr = getValue(row, '急件');
        const isUrgent = priorityStr.includes('急件');

        // Find Last Reply
        let lastReplyDateStr = null;
        ['第4次回覆日', '第3次回覆日', '第2次回覆日', '第1次回覆日'].forEach(tag => {
            const val = getValue(row, tag);
            if (val && val !== '-' && !lastReplyDateStr) lastReplyDateStr = val;
        });

        // --- CALCULATION LOGIC ---

        // A. Review Overdue (審閱逾期)
        let isReviewOverdue = false;
        let reviewDeadline = null;

        if (status !== 'CLOSED' && status !== 'PAUSED' && status !== 'AWAITING_FEEDBACK') {
            const reqDate = new Date(requestDateStr);
            if (isValid(reqDate)) {
                const days = isUrgent ? 3 : 5;
                reviewDeadline = addBusinessDays(reqDate, days);
            }
            // Override with Est Date if present
            if (estDateStr) {
                const est = new Date(estDateStr);
                if (isValid(est)) reviewDeadline = est;
            }

            if (reviewDeadline) {
                const diff = differenceInCalendarDays(today, reviewDeadline);
                const grace = isUrgent ? 1 : 3;
                if (diff > grace) isReviewOverdue = true;
            }
        }

        // B. Post-Review Overdue (未結案逾期)
        let isPostOverdue = false;
        if (lastReplyDateStr && status !== 'CLOSED') {
            const replyDate = new Date(lastReplyDateStr);
            if (isValid(replyDate)) {
                const diff = differenceInCalendarDays(today, replyDate);
                if (diff > 14) isPostOverdue = true;
            }
        }

        // --- COLLECT STATS ---
        if (isReviewOverdue) {
            reviewOverdueCount++;
            if (sampleReviewOverdue.length < 5) {
                sampleReviewOverdue.push({
                    id: contractNumber,
                    statusRaw, // Add this to see the real text
                    status,
                    reqDate: requestDateStr,
                    estDate: estDateStr,
                    deadline: reviewDeadline ? reviewDeadline.toLocaleDateString() : 'N/A'
                });
            }
        }

        if (isPostOverdue) {
            postReviewOverdueCount++;
            if (samplePostOverdue.length < 5) {
                samplePostOverdue.push({
                    id: contractNumber,
                    status,
                    replyDate: lastReplyDateStr
                });
            }
        }
    });

    console.log(`\nTotal Valid Contracts: ${total}`);
    console.log(`\n[REVIEW OVERDUE] Count: ${reviewOverdueCount}`);
    if (reviewOverdueCount > 0) {
        console.log('Sample Review Overdue Cases (Why are they overdue?):');
        console.table(sampleReviewOverdue);
    } else {
        console.log('Great! No review overdue cases found.');
    }

    console.log(`\n[POST-REVIEW OVERDUE] Count: ${postReviewOverdueCount}`);
    if (postReviewOverdueCount > 0) {
        console.log('Sample Post-Review Overdue Cases (Stuck unclosed):');
        console.table(samplePostOverdue);
    }
}

debugContractStatus();
