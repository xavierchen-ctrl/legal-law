import { NextResponse } from 'next/server';
import { fetchContractsFromSheet } from '@/lib/google-sheets';
import { sendNotificationEmail } from '@/lib/email';
import { logSystemEvent } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const { contractNumber, toEmail, ccEmail } = await request.json();

    if (!contractNumber || !toEmail) {
        return NextResponse.json({ error: '請提供合約編號與收件 Email' }, { status: 400 });
    }

    const contracts = await fetchContractsFromSheet();
    const contract = contracts.find(c => c.contractNumber === contractNumber);
    if (!contract) {
        return NextResponse.json({ error: `找不到合約 ${contractNumber}` }, { status: 404 });
    }

    const requesterName = contract.requester?.trim() || contractNumber;
    const caseRef = `【用印申請】${contract.contractNumber} : ${contract.documentName || contract.counterparty}`;
    const isStampDone = contract.stampCompleted && !contract.isArchived;

    const subject = isStampDone
        ? `【歸檔提醒】${contract.contractNumber} 用印已完成，請更新歸檔狀態`
        : caseRef;

    const html = isStampDone ? `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#059669;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約歸檔作業提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.8;">
    <p>${requesterName} 您好，</p>
    <p>這是一封自動提醒郵件。</p>
    <p>關於合約申請案（${caseRef}），系統偵測到雙方用印作業已完成，但合約線上表單尚未更新歸檔狀態，請您儘速完成歸檔作業。</p>
    <p>若您對歸檔流程有任何疑問，請與法務承辦人確認。</p>
    <p>謝謝您的配合。</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#6b7280;font-size:12px;">此為系統自動通知，請勿直接回覆本信件。</p>
  </div>
</div>` : `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#1d4ed8;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">【法務追蹤系統】合約進度催辦提醒</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.8;">
    <p>${requesterName} 您好，</p>
    <p>這是一封自動提醒郵件。</p>
    <p>關於您先前提交的合約申請案（${caseRef}），法務單位已完成初步審閱並提供相關修改建議。</p>
    <p>為了確保後續用印及簽署流程能順利進行，請您儘速跟進此申請案的進度（包括但不限於與契約相對人確認合約審閱意見、確認用印申請進度以及於合約線上表單更新合約紙本與電子檔歸檔進度等），並針對本案為後續相關作業。</p>
    <p>若您對審閱建議有任何疑問，建議可先與法務承辦人溝通確認。</p>
    <p>謝謝您的配合。</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
    <p style="color:#6b7280;font-size:12px;">此為系統自動通知，請勿直接回覆本信件。</p>
  </div>
</div>`;

    const recipients = [toEmail];
    if (ccEmail?.trim()) recipients.push(ccEmail.trim());

    const results = [];
    for (const email of recipients) {
        const ok = await sendNotificationEmail(email, subject, html);
        results.push({ to: email, success: ok });
    }

    await logSystemEvent('Manual_Notify', 'INFO',
        `Manual follow-up sent for ${contractNumber} → ${recipients.join(', ')}`);

    return NextResponse.json({ success: true, results });
}
