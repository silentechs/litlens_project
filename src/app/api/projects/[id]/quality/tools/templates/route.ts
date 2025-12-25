import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
    handleApiError,
    UnauthorizedError,
    success,
} from "@/lib/api";
import {
    ROB2_TEMPLATE,
    ROBINS_I_TEMPLATE,
    NEWCASTLE_OTTAWA_COHORT_TEMPLATE,
} from "@/lib/services/quality-assessment";

// GET /api/projects/[id]/quality/tools/templates - Get standard tool templates
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            throw new UnauthorizedError();
        }

        return success({
            ROB2: {
                name: "Risk of Bias 2.0",
                description: "For randomized controlled trials",
                domains: ROB2_TEMPLATE,
            },
            ROBINS_I: {
                name: "ROBINS-I",
                description: "For non-randomized studies of interventions",
                domains: ROBINS_I_TEMPLATE,
            },
            NEWCASTLE_OTTAWA: {
                name: "Newcastle-Ottawa Scale",
                description: "For cohort studies",
                domains: NEWCASTLE_OTTAWA_COHORT_TEMPLATE,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}
