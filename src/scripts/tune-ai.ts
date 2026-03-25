import { getAIRules } from '../lib/ai-rule-service';
import { analyzeContractWithAI } from '../lib/ai-service';

const mockClauses = [
    {
        name: "Safe Clause (Non-Exclusive)",
        text: "甲乙雙方同意，本合約為非獨家授權，甲方仍有權利將產品授權給第三方。"
    },
    {
        name: "Risky Clause (Exclusive Penalty)",
        text: "若乙方於合約期間內，將本產品之經銷權授權予第三方，則視為重大違約，應支付新台幣伍佰萬元之懲罰性違約金。"
    },
    {
        name: "Ambiguous Clause (Indemnity)",
        text: "因本合約所生之任何損害，均由甲方全額負擔賠償責任，乙方不負任何責任。"
    }
];

async function runTests() {
    console.log("Fetching current AI Rules from Google Sheets...\n");
    const rules = await getAIRules();
    const activeRules = rules.filter(r => r.isActive);
    
    if (activeRules.length === 0) {
        console.log("No active AI rules found. Please add some first.");
        return;
    }

    console.log(`Active Rules Found: ${activeRules.map(r => r.ruleName).join(', ')}\n`);
    console.log("Starting AI Tuning Tests...\n");

    for (const clause of mockClauses) {
        console.log(`========================================================`);
        console.log(`Testing Clause: [${clause.name}]`);
        console.log(`Text: "${clause.text}"\n`);
        
        try {
            // @ts-ignore
            const results = await analyzeContractWithAI(clause.text, activeRules);
            
            let hasFlag = false;
            for (const result of results) {
                if (result.violationFound) {
                    hasFlag = true;
                    console.log(`🚨 FLAG TRIGGERED: ${activeRules[result.ruleId].ruleName}`);
                    console.log(`📝 REASONING: ${result.reasoning}`);
                    console.log(`-----------------------------------`);
                }
            }
            if (!hasFlag) {
                console.log(`✅ AI PASSED: No violations detected.`);
            }
        } catch (error: any) {
            console.error(`Error analyzing clause: ${error.message}`);
        }
        console.log(`========================================================\n`);
        
        // Sleep to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
}

runTests();
