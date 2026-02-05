
import 'dotenv/config';
import { analyzeContractWithAI, AIRule } from './lib/ai-service';

async function runTest() {
    console.log('🤖 Starting AI Logic Test...\n');

    // 1. Mock Contract Text
    // simulating the user's meaningful example
    const mockContractText = `
    【軟體委外開發合約書】
    合約編號：2025-TEST-001
    立合約書人：
    甲　方：潮網科技股份有限公司
    乙　方：黑心軟體工作室

    ...
    第四條：智慧財產權
    1. 本專案開發過程中所產出之原始碼、文件、設計稿等，其智慧財產權概歸屬於「乙方」所有。甲方僅取得永久非專屬授權。
    
    ...
    第七條：違約責任與賠償
    1. 若因可歸責於乙方之事由致甲方受損，乙方應負賠償責任。
    2. 損害賠償金額上限為本合約總價金之 20%。

    ...
    第九條：合約金額
    1. 本專案總價金為新台幣 2,000 萬元整 (未稅)。
    ...
    `;

    console.log('--- Mock Contract Content ---');
    console.log(mockContractText.substring(0, 300) + '... (truncated)');
    console.log('-----------------------------\n');

    // 2. Define AI Rules (Based on user request)
    const testRules: AIRule[] = [
        {
            ruleName: '智財權歸屬不利檢查',
            promptInstruction: '檢查智慧財產權條款。若條款規定智財權歸屬於「乙方」或「非甲方(潮網科技)」，請標記為風險。',
            riskLevel: 'HIGH',
            targetEmail: 'legal@example.com',
            isActive: true
        },
        {
            ruleName: '高額賠償檢查',
            promptInstruction: '請計算損害賠償金額。若「合約總金額」超過 300 萬，且「損害賠償上限」超過 100 萬 (需自行換算百分比與中文數字)，請標記為風險。',
            riskLevel: 'HIGH',
            targetEmail: 'finance@example.com',
            isActive: true
        }
    ];

    console.log('--- Checking Rules ---');
    testRules.forEach(r => console.log(`[${r.ruleName}]: ${r.promptInstruction}`));
    console.log('----------------------\n');

    // 3. Run Analysis
    console.log('🚀 Sending to Google Gemini...');
    const start = Date.now();
    const results = await analyzeContractWithAI(mockContractText, testRules);
    const duration = (Date.now() - start) / 1000;

    console.log(`\n✅ Analysis Complete in ${duration}s!`);
    console.log('\n--- AI Findings ---');
    console.log(JSON.stringify(results, null, 2));

    // 4. Verification Logic
    const ipViolation = results.find(r => r.ruleName === '智財權歸屬不利檢查')?.violationFound;
    const amountViolation = results.find(r => r.ruleName === '高額賠償檢查')?.violationFound;

    if (ipViolation && amountViolation) {
        console.log('\n✨ TEST PASSED: AI correctly identified both risks.');
    } else {
        console.error('\n❌ TEST FAILED: AI missed some risks.');
    }
}

runTest();
