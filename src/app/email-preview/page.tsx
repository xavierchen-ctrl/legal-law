export default function EmailPreviewPage() {
  const contract = {
    contractNumber: 'W250101',
    documentName: '採購合約範本 (2025版)',
    requester: '王小明 (行銷部)',
    requestDate: '2025/01/01',
    priority: 'URGENT',
    lastReplyDate: '2025/01/10',
    overdueDays: 3,
    postReviewDays: 16,
  };

  const deadline = '2025/01/04';

  const template1 = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">合約審閱逾期通知</h2>
      <p>以下合約已超過系統計算之預定回覆日期 (申請日 + 工期)，請儘速處理。</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <ul style="line-height: 1.6; color: #333;">
        <li><strong>合約編號:</strong> ${contract.contractNumber}</li>
        <li><strong>文件名稱:</strong> ${contract.documentName}</li>
        <li><strong>申請人:</strong> ${contract.requester}</li>
        <li><strong>申請日期:</strong> ${contract.requestDate}</li>
        <li><strong>預定回覆日:</strong> ${deadline}</li>
        <li><strong>逾期天數:</strong> ${contract.overdueDays} 天</li>
      </ul>
      <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
    </div>
  `;

  const template2 = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ed6c02;">合約未結案警示</h2>
      <p>以下合約法務已於 <strong>${contract.lastReplyDate}</strong> 回覆，但迄今已超過 14 天仍未結案。</p>
      <p>請確認是否已簽約完成，並更新試算表狀態。</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <ul style="line-height: 1.6; color: #333;">
        <li><strong>合約編號:</strong> ${contract.contractNumber}</li>
        <li><strong>文件名稱:</strong> ${contract.documentName}</li>
        <li><strong>申請人:</strong> ${contract.requester}</li>
        <li><strong>最後回覆日:</strong> ${contract.lastReplyDate}</li>
        <li><strong>滯留天數:</strong> ${contract.postReviewDays} 天</li>
      </ul>
      <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動發送，請勿直接回覆。</p>
    </div>
  `;

  const template3 = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">執行長室法務案件進度匯報</h2>
        <p>以下為截至目前為止，歸屬於「執行長室」且尚未結案之文件清單：</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <thead>
                <tr style="background-color: #f5f5f5;">
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">合約編號</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">文件名稱</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">申請人</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">狀態</th>
                    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">進度備註</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">W250105</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">策略投資意向書</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">Sandy Liu</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">審閱中</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">尚未回覆</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">W250106</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">顧問聘任合約</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">執行長</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">待回覆</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">已回覆 (2025/01/12)</td>
                </tr>
            </tbody>
        </table>
        <p style="margin-top: 20px; color: gray; font-size: 12px;">此為系統自動排程發送 (每週一 09:30)。</p>
    </div>
  `;

  return (
    <div className="container mx-auto py-12 space-y-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Email 通知樣式預覽</h1>
        <p className="text-gray-500">以下模擬真實發送的信件外觀 (使用假資料)</p>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4 text-center text-red-600">樣式一：審閱逾期 (法務端)</h3>
        <div dangerouslySetInnerHTML={{ __html: template1 }} />
      </div>

      <div className="border-t pt-12">
        <h3 className="text-xl font-bold mb-4 text-center text-orange-600">樣式二：未結案警示 (申請端/法務端)</h3>
        <div dangerouslySetInnerHTML={{ __html: template2 }} />
      </div>

      <div className="border-t pt-12">
        <h3 className="text-xl font-bold mb-4 text-center text-green-700">樣式三：執行長室案件匯報 (CEO Weekly)</h3>
        <div dangerouslySetInnerHTML={{ __html: template3 }} />
      </div>
    </div>
  );
}
