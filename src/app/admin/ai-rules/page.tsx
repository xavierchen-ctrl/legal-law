
import AIRulesAdminPage from '@/components/AIRulesAdmin';
import { getAIRules } from '@/lib/ai-rule-service';

export const dynamic = 'force-dynamic';

export default async function Page() {
    const rules = await getAIRules();
    return (
        <AIRulesAdminPage initialRules={rules} />
    );
}
