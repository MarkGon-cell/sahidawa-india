import { API_BASE } from "@/lib/api";

import {
    CSRF_HEADER_NAME,
    getCsrfToken,
    refreshCsrfToken,
    invalidateCsrfToken,
    isCsrfError,
} from "@/lib/csrf";

export type LabTestStatus = "Low" | "Normal" | "High";

export interface LabTestResult {
    testName: string;
    userValue: string;
    referenceRange: string;
    status: LabTestStatus;
    simpleExplanation: string;
}

export interface LabAnalyzerResult {
    success: boolean;
    tests: LabTestResult[];
    summary: string;
    disclaimer: string;
}

export async function analyzeLabReport(file: File, token: string): Promise<LabAnalyzerResult> {
    async function sendRequest(csrfToken: string): Promise<Response> {
        const formData = new FormData();
        formData.append("file", file);

        return fetch(`${API_BASE}/api/v1/ai/lab-analyzer`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                [CSRF_HEADER_NAME]: csrfToken,
            },
            credentials: "include",
            body: formData,
        });
    }

    let csrfToken = await getCsrfToken();
    let response = await sendRequest(csrfToken);

    const firstBody = await response
        .clone()
        .json()
        .catch(() => null);

    if (isCsrfError(response.status, firstBody)) {
        invalidateCsrfToken();
        csrfToken = await refreshCsrfToken();
        response = await sendRequest(csrfToken);
    }

    const result = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            typeof result?.error === "string"
                ? result.error
                : typeof result?.error?.message === "string"
                  ? result.error.message
                  : "Unable to analyze the laboratory report.";

        throw new Error(message);
    }

    if (!result || !Array.isArray(result.tests) || typeof result.summary !== "string") {
        throw new Error("The server returned an invalid laboratory analysis.");
    }

    return result as LabAnalyzerResult;
}
