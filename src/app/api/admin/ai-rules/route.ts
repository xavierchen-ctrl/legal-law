
import { NextResponse } from 'next/server';
import { getAIRules, addAIRule, updateAIRule, deleteAIRule, AIRule } from '@/lib/ai-rule-service';

export async function GET() {
    const rules = await getAIRules();
    return NextResponse.json(rules);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        if (!body.ruleName || !body.promptInstruction) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const newRule: AIRule = {
            ruleName: body.ruleName,
            promptInstruction: body.promptInstruction,
            riskLevel: body.riskLevel || 'MEDIUM',
            targetEmail: body.targetEmail || '', // Optional
            isActive: true
        };

        await addAIRule(newRule);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to add rule:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { index, rule } = body;

        if (index === undefined || !rule) {
            return NextResponse.json({ error: 'Missing index or rule' }, { status: 400 });
        }

        await updateAIRule(index, rule);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update rule:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const indexStr = searchParams.get('index');

        if (indexStr === null) {
            return NextResponse.json({ error: 'Missing index' }, { status: 400 });
        }

        const index = parseInt(indexStr, 10);
        await deleteAIRule(index);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete rule:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
