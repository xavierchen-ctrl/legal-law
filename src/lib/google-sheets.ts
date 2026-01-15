import Papa from 'papaparse';

const SHEET_csv_URL = 'https://docs.google.com/spreadsheets/d/1S8CG7PyILAGK57Y7zNzwf4B9_XX4kGmzeBH84bUjhwE/export?format=csv&gid=1607545574';

export interface SheetContract {
    id: string; // Map from 合約編號
    contractNumber: string;
    requestDate: string;
    department: string;
    requester: string;
    requesterEmail?: string; // Not in sheet, maybe hardcode or leave empty
    counterparty: string;
    documentName: string;
    priority: 'URGENT' | 'NORMAL';
    status: string;
    estimatedReplyDate: string | null;
    lastReplyDate: string | null; // New field for Post-Review Tracking
}

export async function fetchContractsFromSheet(): Promise<SheetContract[]> {
    try {
        const res = await fetch(SHEET_csv_URL, { cache: 'no-store' });
        const csvText = await res.text();

        // Find the start of the real header: "合約編號/取單號"
        const headerStart = csvText.indexOf('合約編號/取單號');
        if (headerStart === -1) {
            console.error('Could not find header row in CSV');
            return [];
        }

        // Slice from the header start
        const cleanCsv = csvText.substring(headerStart);

        const result = Papa.parse(cleanCsv, {
            header: true,
            skipEmptyLines: true,
        });

        const data = result.data as any[];
        // console.log(`Parsed ${data.length} rows from Google Sheet`);

        return data.map((row, index) => {
            // Helper to find value by partial key match
            const getValue = (r: any, partialKey: string) => {
                const key = Object.keys(r).find(k => k.includes(partialKey));
                return key ? r[key] : '';
            };

            const contractNumber = getValue(row, '合約編號') || getValue(row, '取單號') || `UNKNOWN-${index}`;
            const priorityCell = getValue(row, '急件');
            const priority = priorityCell.includes('急件') ? 'URGENT' : 'NORMAL';

            const statusRaw = getValue(row, '審閱進度');
            let status = 'SUBMITTED';

            if (statusRaw.includes('已結案') || statusRaw.includes('完成') || statusRaw.includes('結案')) {
                status = 'CLOSED';
            } else if (statusRaw.includes('暫停')) {
                status = 'PAUSED';
            } else if (statusRaw.includes('待需求單位回覆') || statusRaw.includes('待回覆')) {
                status = 'AWAITING_FEEDBACK';
            } else if (statusRaw.includes('法務審閱中') || statusRaw.includes('審閱中')) {
                status = 'IN_REVIEW';
            }

            const counterparty = getValue(row, '相對人');
            const requestDateRaw = getValue(row, '申請日期');

            // Find Latest Reply Date (1st to 4th)
            let lastReplyDate = null;
            const replyDates = [
                getValue(row, '第4次回覆日'),
                getValue(row, '第3次回覆日'),
                getValue(row, '第2次回覆日'),
                getValue(row, '第1次回覆日')
            ];
            // Find the first non-empty, non-dash date
            const validReplyDate = replyDates.find(d => d && d.trim() !== '' && d.trim() !== '-');
            if (validReplyDate) {
                lastReplyDate = validReplyDate;
            }

            return {
                id: contractNumber,
                contractNumber,
                requestDate: requestDateRaw,
                department: getValue(row, '需求單位'),
                requester: getValue(row, '申請人'),
                counterparty: counterparty,
                documentName: getValue(row, '文件名稱'),
                priority,
                status,
                estimatedReplyDate: getValue(row, '預計回覆日') || null,
                lastReplyDate,
            };
        });
    } catch (error) {
        console.error('Error fetching sheet:', error);
        return [];
    }
}
