"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CheckCircle,
    XCircle,
    Clock,
    Store,
    Phone,
    FileText,
    User,
    MapPin,
    Loader2,
    RefreshCw,
    ShieldCheck,
    ShieldAlert,
} from "lucide-react";
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(
    /\/+$/,
    ""
);
import { useSession } from "@/src/components/AuthProvider";
import {
    getCsrfToken,
    refreshCsrfToken,
    invalidateCsrfToken,
    isCsrfError,
    CSRF_HEADER_NAME,
} from "@/lib/csrf";
import { parseApiErrorString } from "@/lib/apiErrorHandler";

type ClaimStatus = "pending" | "approved" | "rejected";

interface Pharmacy {
    id: string;
    name: string;
    address: string | null;
    district: string | null;
    state: string | null;
    phone_number: string | null;
    is_verified: boolean;
    is_active: boolean;
}

interface PharmacyClaim {
    id: string;
    pharmacy_id: string;
    user_id: string;
    drug_license_number: string;
    owner_name: string;
    phone_number: string;
    status: ClaimStatus;
    created_at: string;
    updated_at: string;
    pharmacies: Pharmacy | null;
}
function getApiErrorMessage(data: unknown, fallback: string): string {
    if (data && typeof data === "object" && "error" in data) {
        const error = (data as { error?: unknown }).error;

        if (typeof error === "string") {
            return error;
        }

        if (
            error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
        ) {
            return (error as { message: string }).message;
        }
    }

    return fallback;
}
export default function PendingPharmacyClaimsPage() {
    const { token, isLoading: authLoading } = useSession();

    const [claims, setClaims] = useState<PharmacyClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedClaim, setSelectedClaim] = useState<PharmacyClaim | null>(null);

    const authHeaders = useCallback(
        () => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${token ?? ""}`,
        }),
        [token]
    );

    const fetchClaims = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_ORIGIN}/api/pharmacies/admin/claims?status=pending`, {
                headers: authHeaders(),
            });

            if (res.status === 401) {
                throw new Error("You must be logged in to access this page.");
            }

            if (res.status === 403) {
                throw new Error("You do not have permission to review pharmacy claims.");
            }

            const data = await res.json();

            if (!res.ok) {
                throw new Error(getApiErrorMessage(data, "Failed to load pharmacy claims."));
            }

            setClaims(data.claims ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load pharmacy claims.");
        } finally {
            setLoading(false);
        }
    }, [token, authHeaders]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchClaims();
        }
    }, [authLoading, token, fetchClaims]);

    const handleApprove = async (claimId: string) => {
        if (!token) return;

        setActing(claimId);
        setError(null);

        try {
            let csrfToken = await getCsrfToken();

            const doRequest = (csrf: string) =>
                fetch(`${API_ORIGIN}/api/pharmacies/admin/claims/${claimId}/approve`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        ...authHeaders(),
                        [CSRF_HEADER_NAME]: csrf,
                    },
                });

            let res = await doRequest(csrfToken);

            // Refresh CSRF token once if it has expired.
            if (res.status === 403) {
                const body = await res.json().catch(() => ({}));

                if (isCsrfError(res.status, body)) {
                    invalidateCsrfToken();
                    csrfToken = await refreshCsrfToken();
                    res = await doRequest(csrfToken);
                } else {
                    throw new Error(parseApiErrorString(body, "Failed to approve pharmacy claim."));
                }
            }

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(parseApiErrorString(data, "Failed to approve pharmacy claim."));
            }

            setClaims((prev) => prev.filter((claim) => claim.id !== claimId));
            setSelectedClaim(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to approve pharmacy claim.");
        } finally {
            setActing(null);
        }
    };

    const handleReject = async (claimId: string) => {
        if (!token) return;

        const confirmed = window.confirm("Are you sure you want to reject this pharmacy claim?");

        if (!confirmed) return;

        setActing(claimId);
        setError(null);

        try {
            let csrfToken = await getCsrfToken();

            const doRequest = (csrf: string) =>
                fetch(`${API_ORIGIN}/api/pharmacies/admin/claims/${claimId}/reject`, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        ...authHeaders(),
                        [CSRF_HEADER_NAME]: csrf,
                    },
                    body: JSON.stringify({}),
                });

            let res = await doRequest(csrfToken);

            // Refresh CSRF token once if it has expired.
            if (res.status === 403) {
                const body = await res.json().catch(() => ({}));

                if (isCsrfError(res.status, body)) {
                    invalidateCsrfToken();
                    csrfToken = await refreshCsrfToken();
                    res = await doRequest(csrfToken);
                } else {
                    throw new Error(parseApiErrorString(body, "Failed to reject pharmacy claim."));
                }
            }

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(parseApiErrorString(data, "Failed to reject pharmacy claim."));
            }

            setClaims((prev) => prev.filter((claim) => claim.id !== claimId));
            setSelectedClaim(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to reject pharmacy claim.");
        } finally {
            setActing(null);
        }
    };

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                                <Store className="h-5 w-5" />
                            </div>

                            <div>
                                <h1 className="text-xl font-bold text-slate-900">
                                    Pharmacy Verification
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Review and verify pharmacy partner claims
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={fetchClaims}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">
                {/* Stats */}
                <div className="mb-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <Clock className="h-5 w-5" />
                        </div>

                        <p className="text-sm text-slate-500">Pending Verification</p>

                        <p className="mt-1 text-3xl font-bold text-slate-900">{claims.length}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
                            <ShieldCheck className="h-5 w-5" />
                        </div>

                        <p className="text-sm text-slate-500">Verification Status</p>

                        <p className="mt-1 text-lg font-semibold text-green-600">Admin Review</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Store className="h-5 w-5" />
                        </div>

                        <p className="text-sm text-slate-500">Pharmacy Claims</p>

                        <p className="mt-1 text-lg font-semibold text-slate-900">Partner Portal</p>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Claims */}
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-5">
                        <h2 className="font-semibold text-slate-900">Pending Pharmacy Claims</h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Review the submitted pharmacy information before granting the verified
                            badge.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading pharmacy claims...
                        </div>
                    ) : claims.length === 0 ? (
                        <div className="py-20 text-center">
                            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-green-400" />

                            <h3 className="font-semibold text-slate-800">No pending claims</h3>

                            <p className="mt-1 text-sm text-slate-500">
                                All pharmacy registration requests have been reviewed.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {claims.map((claim) => (
                                <div key={claim.id} className="p-6 transition hover:bg-slate-50/60">
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="mb-3 flex items-center gap-3">
                                                <Store className="h-5 w-5 text-blue-600" />

                                                <h3 className="font-semibold text-slate-900">
                                                    {claim.pharmacies?.name ?? "Unknown Pharmacy"}
                                                </h3>

                                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                                                    PENDING
                                                </span>
                                            </div>

                                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                                                <div>
                                                    <p className="text-xs text-slate-400">Owner</p>

                                                    <p className="mt-1 font-medium text-slate-800">
                                                        {claim.owner_name}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">
                                                        Drug License
                                                    </p>

                                                    <p className="mt-1 font-mono font-medium text-slate-800">
                                                        {claim.drug_license_number}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">Phone</p>

                                                    <p className="mt-1 font-medium text-slate-800">
                                                        {claim.phone_number}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs text-slate-400">
                                                        Submitted
                                                    </p>

                                                    <p className="mt-1 font-medium text-slate-800">
                                                        {new Date(
                                                            claim.created_at
                                                        ).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setSelectedClaim(claim)}
                                            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                                        >
                                            Review Claim
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Review Modal */}
            {selectedClaim && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Review Pharmacy Claim
                                    </h2>

                                    <p className="mt-1 text-sm text-slate-500">
                                        Verify the submitted pharmacy details.
                                    </p>
                                </div>

                                <button
                                    onClick={() => setSelectedClaim(null)}
                                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                >
                                    <XCircle className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <DetailRow
                                icon={Store}
                                label="Pharmacy"
                                value={selectedClaim.pharmacies?.name ?? "Unknown Pharmacy"}
                            />

                            <DetailRow
                                icon={MapPin}
                                label="Address"
                                value={selectedClaim.pharmacies?.address ?? "Not available"}
                            />

                            <DetailRow icon={User} label="Owner" value={selectedClaim.owner_name} />

                            <DetailRow
                                icon={FileText}
                                label="Drug License Number"
                                value={selectedClaim.drug_license_number}
                            />

                            <DetailRow
                                icon={Phone}
                                label="Contact Number"
                                value={selectedClaim.phone_number}
                            />

                            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                                <div className="flex gap-3">
                                    <ShieldAlert className="h-5 w-5 shrink-0" />

                                    <p>
                                        Approving this claim will mark the pharmacy as verified and
                                        enable its verified badge.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end">
                            <button
                                onClick={() => handleReject(selectedClaim.id)}
                                disabled={!!acting}
                                className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                                {acting === selectedClaim.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                Reject
                            </button>

                            <button
                                onClick={() => handleApprove(selectedClaim.id)}
                                disabled={!!acting}
                                className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                            >
                                {acting === selectedClaim.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4" />
                                )}
                                Approve & Verify
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function DetailRow({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Store;
    label: string;
    value: string;
}) {
    return (
        <div className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1 font-medium break-words text-slate-800">{value}</p>
            </div>
        </div>
    );
}
