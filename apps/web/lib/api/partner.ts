import { fetchWithRetry } from "../apiWithRetry";
import {
    getCsrfToken,
    refreshCsrfToken,
    invalidateCsrfToken,
    isCsrfError,
    CSRF_HEADER_NAME,
} from "../csrf";
import { parseApiErrorString } from "../apiErrorHandler";
import { getSessionAccessToken } from "../accessToken";
import type { PharmacyClaimInput } from "@sahidawa/validators";

export interface PharmacyClaimResponse {
    success: boolean;
    message?: string;
    error?: string;
    claim?: unknown;
}

export async function submitPharmacyClaim(
    data: PharmacyClaimInput,
    signal?: AbortSignal
): Promise<PharmacyClaimResponse> {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/pharmacies/claim`;

    const doRequest = (csrfToken: string) => {
        const accessToken = getSessionAccessToken();
        console.log("Partner claim access token exists:", !!accessToken);
        return fetchWithRetry(url, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                [CSRF_HEADER_NAME]: csrfToken,
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify(data),
            timeout: 10000,
            signal,
        });
    };

    try {
        let csrfToken = await getCsrfToken();
        let res = await doRequest(csrfToken);

        if (!res.ok && res.status === 403) {
            const body = await res.json().catch(() => ({}));

            if (isCsrfError(res.status, body)) {
                invalidateCsrfToken();
                csrfToken = await refreshCsrfToken();
                res = await doRequest(csrfToken);
            } else {
                throw new Error(parseApiErrorString(body, "Failed to submit pharmacy claim."));
            }
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));

            throw new Error(parseApiErrorString(body, "Failed to submit pharmacy claim."));
        }

        const json = await res.json();

        return {
            success: true,
            message: json.message || "Pharmacy claim submitted successfully.",
            claim: json.claim,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err?.message || "An unknown error occurred while submitting the claim.",
        };
    }
}

export interface PharmacySearchResult {
    id: string;
    name: string;
    address: string;
    district: string;
    state: string;
    phone_number?: string | null;
    is_verified?: boolean;
}

export async function searchPharmacies(
    query: string,
    signal?: AbortSignal
): Promise<PharmacySearchResult[]> {
    const url = `${
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    }/api/pharmacies/search?q=${encodeURIComponent(query)}`;

    const res = await fetchWithRetry(url, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        timeout: 10000,
        signal,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));

        throw new Error(parseApiErrorString(body, "Failed to search pharmacies."));
    }

    const json = await res.json();

    return json.pharmacies ?? [];
}
export interface MyPharmacyClaim {
    id: string;
    pharmacy_id: string;
    user_id: string;
    drug_license_number: string;
    owner_name: string;
    phone_number: string;
    status: "pending" | "approved" | "rejected";
    created_at: string;
    updated_at: string;
    pharmacies: {
        id: string;
        name: string;
        address: string | null;
        district: string | null;
        state: string | null;
        phone_number: string | null;
        is_verified: boolean;
        is_active: boolean;
    } | null;
}

export async function getMyPharmacyClaims(): Promise<MyPharmacyClaim[]> {
    const url = `${
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    }/api/pharmacies/my-claims`;

    const accessToken = getSessionAccessToken();

    const res = await fetchWithRetry(url, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        timeout: 10000,
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(parseApiErrorString(body, "Failed to load pharmacy registration status."));
    }

    return body.claims ?? [];
}
