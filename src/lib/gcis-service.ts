/**
 * gcis-service.ts
 * 串接「經濟部商工行政資料開放平臺 (GCIS)」API
 * 文件：https://data.gcis.nat.gov.tw/
 *
 * 注意：findbiz.nat.gov.tw 受 Cloudflare Bot 保護，server-side fetch 無法取得結果，
 * 故統一使用 GCIS open data API（無 Bot 保護的政府開放資料端點）。
 */

const GCIS_API_BASE = 'https://data.gcis.nat.gov.tw/od/data/api';
const COMPANY_LOOKUP_UUID = '5F64D864-61CB-4D0D-8AD9-492047CC1EA6';

export interface GcisCompany {
    Business_Accounting_NO: string;
    Company_Name: string;
    Company_Status: string;
    Company_Status_Desc: string;
    Responsible_Name?: string;
    Registered_Capital_Amount?: string;
    Company_Location?: string;
    date_approved?: string;
}

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'UNKNOWN';

export interface GcisCheckItem {
    id: number;
    title: string;
    description: string;
    status: CheckStatus;
    detail: string;
}

export interface GcisVerifyResult {
    queried: boolean;
    companyData: GcisCompany | null;
    checks: GcisCheckItem[];
    gcisLink: string;
    queriedAt: string;
}

// ── 內部 fetch helper ──────────────────────────────────────────

async function gcisGet(params: string): Promise<GcisCompany | null> {
    const url = `${GCIS_API_BASE}/${COMPANY_LOOKUP_UUID}?$format=json&$top=1&${params}`;
    try {
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) && data.length > 0 ? (data[0] as GcisCompany) : null;
    } catch {
        return null;
    }
}

// ── 統一編號查詢 ───────────────────────────────────────────────

async function fetchByBusinessNo(businessNo: string): Promise<GcisCompany | null> {
    return gcisGet(`$filter=${encodeURIComponent(`Business_Accounting_NO eq ${businessNo}`)}`);
}

// ── 公司名稱查詢（多策略） ─────────────────────────────────────

async function fetchByCompanyName(companyName: string): Promise<GcisCompany | null> {
    // 策略 1：精確全名
    let result = await gcisGet(`$filter=${encodeURIComponent(`Company_Name eq '${companyName}'`)}`);
    if (result) return result;

    // 策略 2：contains（OData v4）
    result = await gcisGet(`$filter=${encodeURIComponent(`contains(Company_Name,'${companyName}')`)}`);
    if (result) return result;

    // 策略 3：substringof（OData v2，部分端點支援）
    result = await gcisGet(`$filter=${encodeURIComponent(`substringof('${companyName}',Company_Name) eq true`)}`);
    if (result) return result;

    // 策略 4：去掉公司型態後綴，搜尋品牌核心詞
    const keyword = companyName
        .replace(/(股份有限公司|有限公司|股份公司|工業社|實業|企業|科技|國際)$/, '')
        .trim();

    if (keyword && keyword !== companyName) {
        result = await gcisGet(`$filter=${encodeURIComponent(`contains(Company_Name,'${keyword}')`)}`);
        if (result) return result;

        result = await gcisGet(`$filter=${encodeURIComponent(`substringof('${keyword}',Company_Name) eq true`)}`);
        if (result) return result;
    }

    // 策略 5：$search 全文搜尋（部分 GCIS 端點支援）
    const searchTerm = keyword || companyName;
    result = await gcisGet(`$search=${encodeURIComponent(searchTerm)}`);
    if (result) return result;

    return null;
}

// ── 特殊法人偵測 ───────────────────────────────────────────────

function detectSpecialEntity(companyName: string): { isSpecial: boolean; category: string } {
    const name = companyName || '';
    if (/財團法人/.test(name)) return { isSpecial: true, category: '財團法人' };
    if (/社團法人/.test(name)) return { isSpecial: true, category: '社團法人' };
    if (/大學|學院|高中|國中|國小|學校/.test(name)) return { isSpecial: true, category: '學校' };
    if (/醫院|診所|衛生所|醫療/.test(name)) return { isSpecial: true, category: '醫療機構' };
    if (/公所|市政府|縣政府|鄉公所/.test(name)) return { isSpecial: true, category: '政府機關' };
    if (/協會|公會|聯合會/.test(name)) return { isSpecial: true, category: '協會' };
    return { isSpecial: false, category: '' };
}

// ── 四項核查 ───────────────────────────────────────────────────

function runChecks(inputName: string, inputNo: string, gcisData: GcisCompany | null): GcisCheckItem[] {
    const checks: GcisCheckItem[] = [];

    // 核查 1：名稱與統一編號一致性
    if (!gcisData) {
        checks.push({
            id: 1,
            title: '公司名稱與統一編號一致性',
            description: '確認統一編號對應的公司名稱與合約載明一致',
            status: inputNo ? 'FAIL' : 'UNKNOWN',
            detail: inputNo
                ? `查無統一編號「${inputNo}」的公司登記資料，請確認編號是否正確。`
                : '未提供統一編號，無法比對一致性。',
        });
    } else {
        const gcisName = gcisData.Company_Name?.trim() ?? '';
        const inputNameTrimmed = inputName?.trim() ?? '';
        const nameMatches =
            gcisName === inputNameTrimmed ||
            gcisName.includes(inputNameTrimmed) ||
            inputNameTrimmed.includes(gcisName);
        checks.push({
            id: 1,
            title: '公司名稱與統一編號一致性',
            description: '確認統一編號對應的公司名稱與合約載明一致',
            status: nameMatches ? 'PASS' : 'FAIL',
            detail: nameMatches
                ? `商工資料：「${gcisName}」，與合約相對人「${inputNameTrimmed}」相符。`
                : `⚠️ 不一致！商工登記名稱為「${gcisName}」，但合約載明「${inputNameTrimmed}」，請確認是否有誤或使用舊名稱。`,
        });
    }

    // 核查 2：公司存續狀態
    if (!gcisData) {
        checks.push({
            id: 2,
            title: '公司有效存續狀態',
            description: '確認公司為正常營業狀態（非解散、停業或撤銷）',
            status: 'UNKNOWN',
            detail: '無法查得公司資料，無法判斷存續狀態。',
        });
    } else {
        const statusDesc = gcisData.Company_Status_Desc?.trim() ?? '';
        const isActive = statusDesc.includes('核准設立') || statusDesc === '正常';
        checks.push({
            id: 2,
            title: '公司有效存續狀態',
            description: '確認公司為正常營業狀態（非解散、停業或撤銷）',
            status: isActive ? 'PASS' : 'FAIL',
            detail: isActive
                ? `公司狀態：「${statusDesc}」，確認為有效存續公司。`
                : `⚠️ 公司狀態異常！商工登記顯示：「${statusDesc}」，簽約前請謹慎確認。`,
        });
    }

    // 核查 3：交易主體確認
    if (!gcisData) {
        checks.push({
            id: 3,
            title: '契約相對人主體確認',
            description: '確認契約相對人為實際交易主體，避免使用錯誤或關係企業名稱',
            status: 'UNKNOWN',
            detail: '無法取得商工資料，建議由需求單位確認交易主體資訊是否正確。',
        });
    } else {
        checks.push({
            id: 3,
            title: '契約相對人主體確認',
            description: '確認契約相對人為實際交易主體，避免使用錯誤或關係企業名稱',
            status: 'WARN',
            detail: `系統已從商工確認「${gcisData.Company_Name}」存在登記，但無法自動判斷是否為關係企業或子公司。建議由需求單位確認交易主體資訊是否正確。`,
        });
    }

    // 核查 4：特殊法人警示
    const { isSpecial, category } = detectSpecialEntity(inputName);
    let specialDetail = '';
    if (isSpecial) {
        specialDetail = `⚠️ 偵測到相對人可能為「${category}」，此類特殊法人有特定簽約主體規範，請確認簽約代表人權限是否符合相關法規。`;
    } else if (gcisData?.Company_Name) {
        const { isSpecial: gcisSpecial, category: gcisCategory } = detectSpecialEntity(gcisData.Company_Name);
        if (gcisSpecial) {
            specialDetail = `⚠️ 商工登記名稱顯示為「${gcisCategory}」類型，請確認簽約主體與代表人的法律授權。`;
        }
    }
    checks.push({
        id: 4,
        title: '特殊法人簽約主體警示',
        description: '針對學校、醫療院所、財團法人等特殊法人進行提示',
        status: isSpecial || (gcisData && detectSpecialEntity(gcisData.Company_Name).isSpecial) ? 'WARN' : 'PASS',
        detail: specialDetail || '未偵測到特殊法人特徵，相對人為一般公司/商業型態。',
    });

    return checks;
}

// ── 對外主函式 ─────────────────────────────────────────────────

export async function verifyCompanyWithGcis(
    companyName: string,
    businessNo?: string
): Promise<GcisVerifyResult> {
    const queriedAt = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    const gcisLink = 'https://findbiz.nat.gov.tw/fts/query/QueryBar/queryInit.do';

    let companyData: GcisCompany | null = null;

    try {
        if (businessNo && /^\d{8}$/.test(businessNo.trim())) {
            companyData = await fetchByBusinessNo(businessNo.trim());
        }

        if (!companyData && companyName?.trim()) {
            companyData = await fetchByCompanyName(companyName.trim());
        }
    } catch (err) {
        console.error('[GCIS] Query failed:', err);
    }

    const checks = runChecks(companyName, businessNo ?? '', companyData);

    return {
        queried: companyData !== null,
        companyData,
        checks,
        gcisLink,
        queriedAt,
    };
}
