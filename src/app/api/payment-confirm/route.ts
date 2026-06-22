import { NextResponse } from 'next/server';
import { sendNotificationEmail } from '@/lib/email';
import { logSystemEvent } from '@/lib/logger';
import type { PaymentCheckResult } from '@/lib/payment-service';

export const dynamic = 'force-dynamic';

const RISK_LABEL = { HIGH: '高風險', MEDIUM: '中風險', LOW: '低風險' };
const REC_LABEL = { APPROVE: '同意', ESCALATE: '需上級核准', REJECT: '建議拒絕' };

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            contractNumber,
            documentName,
            counterparty,
            requesterEmail,
            financeEmail,
            result,
            confirmedBy,
            confirmedAt,
        }: {
            contractNumber: string;
            documentName: string;
            counterparty: string;
            requesterEmail: string;
            financeEmail: string;
            result: PaymentCheckResult;
            confirmedBy: string;
            confirmedAt: string;
        } = body;

        if (!result) {
            return NextResponse.json({ error: '缺少分析結果。' }, { status: 400 });
        }

        const refSourceLabel = (t: string) => ({
            USER_HISTORICAL: '使用者提供之過往條件',
            COMPANY_POLICY:  '使用者提供之公司政策',
            AI_ESTIMATE:     'AI 一般商業常識推估（無外部資料）',
            NONE:            '無對應參考',
        } as Record<string, string>)[t] ?? '—';

        const deviationRows = result.deviations.length > 0
            ? result.deviations.map(d => `
                <tr style="background:${d.deviationType === 'UNFAVORABLE' ? '#fff1f0' : d.deviationType === 'FAVORABLE' ? '#f6ffed' : '#f9fafb'}">
                    <td style="padding:6px 10px;border:1px solid #e5e7eb">${d.field}</td>
                    <td style="padding:6px 10px;border:1px solid #e5e7eb">${d.currentValue}${d.currentValueSource ? `<br/><span style='color:#9ca3af;font-size:11px'>來源：${d.currentValueSource}</span>` : ''}</td>
                    <td style="padding:6px 10px;border:1px solid #e5e7eb">${d.referenceValue}<br/><span style='color:#9ca3af;font-size:11px'>來源：${refSourceLabel(d.referenceSourceType)}${d.referenceSourceNote ? ` — ${d.referenceSourceNote}` : ''}</span></td>
                    <td style="padding:6px 10px;border:1px solid #e5e7eb;color:${d.deviationType === 'UNFAVORABLE' ? '#dc2626' : d.deviationType === 'FAVORABLE' ? '#16a34a' : '#6b7280'}">${d.riskDescription}</td>
                </tr>`).join('')
            : '<tr><td colspan="4" style="padding:8px;text-align:center;color:#6b7280">無異常差異</td></tr>';

        const milestones = result.extractedTerms.paymentMilestones.length > 0
            ? result.extractedTerms.paymentMilestones.join('、')
            : '—';

        const riskColor = result.riskLevel === 'HIGH' ? '#dc2626' : result.riskLevel === 'MEDIUM' ? '#d97706' : '#16a34a';

        const emailHtml = `
<div style="font-family:sans-serif;max-width:700px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px;border-radius:8px 8px 0 0">
        <h2 style="color:white;margin:0;font-size:18px">💳 付款條件審閱確認通知</h2>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">Legal Flow — 付款條件比對系統</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px">
            <tr><td style="padding:4px 0;color:#6b7280;width:120px">合約編號</td><td style="font-weight:600">${contractNumber}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">合約名稱</td><td>${documentName}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">相對人</td><td>${counterparty}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">確認人員</td><td>${confirmedBy}</td></tr>
            <tr><td style="padding:4px 0;color:#6b7280">確認時間</td><td>${confirmedAt}</td></tr>
        </table>

        <div style="background:#f9fafb;border-radius:6px;padding:16px;margin-bottom:16px">
            <p style="margin:0 0 8px;font-weight:600;font-size:13px">📋 擷取之付款條件</p>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
                <tr><td style="color:#6b7280;padding:2px 0;width:100px">付款期間</td><td>${result.extractedTerms.paymentPeriod}</td></tr>
                <tr><td style="color:#6b7280;padding:2px 0">付款方式</td><td>${result.extractedTerms.paymentMethod}</td></tr>
                <tr><td style="color:#6b7280;padding:2px 0">付款里程碑</td><td>${milestones}</td></tr>
                <tr><td style="color:#6b7280;padding:2px 0">逾期罰息</td><td>${result.extractedTerms.latePaymentPenalty ?? '未約定'}</td></tr>
                <tr><td style="color:#6b7280;padding:2px 0">幣別</td><td>${result.extractedTerms.currency}</td></tr>
            </table>
        </div>

        <p style="margin:0 0 8px;font-weight:600;font-size:13px">⚠️ 差異比對結果</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <thead>
                <tr style="background:#f3f4f6">
                    <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">項目</th>
                    <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">合約條件</th>
                    <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">參考條件</th>
                    <th style="padding:6px 10px;border:1px solid #e5e7eb;text-align:left">風險說明</th>
                </tr>
            </thead>
            <tbody>${deviationRows}</tbody>
        </table>

        <div style="border-left:4px solid ${riskColor};padding:10px 14px;background:#f9fafb;border-radius:0 6px 6px 0;margin-bottom:16px">
            <p style="margin:0;font-size:13px"><strong>整體風險：</strong><span style="color:${riskColor}">${RISK_LABEL[result.riskLevel]}</span>
            ｜ <strong>建議：</strong>${REC_LABEL[result.recommendation]}
            ${result.approvalLevel ? `｜ <strong>核准層級：</strong>${result.approvalLevel}` : ''}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#4b5563">${result.summary}</p>
        </div>

        <p style="font-size:12px;color:#9ca3af;margin:0">此為系統自動發送，請勿直接回覆。如有問題請聯繫法務單位。</p>
    </div>
</div>`;

        const subject = `【付款條件審閱】${contractNumber} - ${RISK_LABEL[result.riskLevel]} / ${REC_LABEL[result.recommendation]}`;

        const recipients = [requesterEmail, financeEmail].filter(Boolean);
        let emailsSent = 0;
        for (const to of recipients) {
            const sent = await sendNotificationEmail(to, subject, emailHtml);
            if (sent) emailsSent++;
        }

        await logSystemEvent('PaymentCheck', 'INFO',
            `Payment terms confirmed for ${contractNumber} by ${confirmedBy}. Risk: ${result.riskLevel}. Notified ${emailsSent} recipients.`
        );

        return NextResponse.json({
            success: true,
            emailsSent,
            message: `付款條件確認完成，已通知 ${emailsSent} 位相關人員。`,
        });

    } catch (error: any) {
        console.error('[payment-confirm] Error:', error);
        return NextResponse.json({ error: `確認作業失敗：${error.message}` }, { status: 500 });
    }
}
