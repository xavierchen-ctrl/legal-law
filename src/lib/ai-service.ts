
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logSystemEvent } from './logger';

const apiKey = process.env.GEMINI_API_KEY;

export interface AIRule {
    ruleName: string;
    promptInstruction: string;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    targetEmail: string;
}

export interface AIAnalysisResult {
    ruleId: number;
    violationFound: boolean;
    reasoning: string;
}

/**
 * Validates connectivity to Gemini API
 */
export async function testGeminiConnection(apiKey?: string): Promise<boolean> {
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;
    if (!effectiveKey) {
        console.error('GEMINI_API_KEY is not set');
        return false;
    }
    try {
        const genAI = new GoogleGenerativeAI(effectiveKey as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent('Say "Hello World" if you can hear me.');
        const response = result.response;
        const text = response.text();
        console.log('Gemini Test Response:', text);
        return text.toLowerCase().includes('hello');
    } catch (error) {
        console.error('Gemini Connection Failed:', error);
        return false;
    }
}

/**
 * Analyzes contract text against a set of rules
 */
export async function analyzeContractWithAI(text: string, rules: AIRule[], apiKey?: string): Promise<AIAnalysisResult[]> {
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY;

    if (!effectiveKey) {
        await logSystemEvent('AI_Service', 'ERROR', 'Missing GEMINI_API_KEY');
        return [];
    }

    if (rules.length === 0) return [];

    try {
        const genAI = new GoogleGenerativeAI(effectiveKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

        // Construct Prompt
        const rulesText = rules.map((r, i) => `
        ID: ${i}
        Name: ${r.ruleName}
        Instruction: ${r.promptInstruction}
        ----------------------------------
        `).join('\n');

        const prompt = `
        You are a senior Legal AI Assistant for "潮網科技 (Wavenet)".
        Analyze the following contract text and check for violations of the specified rules.
        
        Input Contract Text:
        """
        ${text.substring(0, 5000)} 
        """
        (Text truncated to first 5k chars for efficiency)

        Rules to Check:
        ${rulesText}

        Output Format:
        Return ONLY a raw JSON array (no markdown code blocks) with the following structure:
        [
            {
                "ruleId": 0, // The Integer ID from the Rules list above
                "violationFound": true/false,
                "reasoning": "Explanation of why it violates or passes (in Traditional Chinese)"
            }
        ]
        `;

        // ... Prompt Construction ...

        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount <= maxRetries) {
            try {
                const result = await model.generateContent(prompt);
                const response = result.response;
                let responseText = response.text();

                // Clean markdown code blocks if present
                responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                console.log('🤖 AI Raw output:', responseText);

                const analysis = JSON.parse(responseText) as AIAnalysisResult[];
                return analysis;

            } catch (error: any) {
                if (error.message?.includes('429') || error.status === 429) {
                    retryCount++;
                    if (retryCount > maxRetries) throw error;
                    const delay = Math.pow(2, retryCount) * 5000; // 10s, 20s, 40s
                    console.log(`⚠️ 429 Too Many Requests. Retrying in ${delay / 1000}s... (Attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error; // Rethrow non-429 errors
                }
            }
        }
        return []; // Should not reach here
    } catch (error: any) {
        console.error('AI Analysis Failed:', error);
        await logSystemEvent('AI_Service', 'ERROR', `Analysis failed: ${error.message}`);

        // Throw error to let caller know (especially for manual scans/quota limit)
        throw error;
    }
}
