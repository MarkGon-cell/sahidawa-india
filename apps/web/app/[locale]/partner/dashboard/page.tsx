"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CheckCircle,
    Clock,
    XCircle,
    Store,
    FileText,
    Phone,
    User,
    MapPin,
    Loader2,
    RefreshCw,
    ShieldCheck,
    ArrowLeft,
} from "lucide-react";
import Link from "next/link";

import { useSession } from "@/src/components/AuthProvider";
import { getMyPharmacyClaims, type MyPharmacyClaim } from "@/lib/api/partner";

type ClaimStatus = MyPharmacyClaim["status"];

const statusConfig: Record<
    ClaimStatus,
    {
        label: string;
        description: string;
        icon: typeof Clock;
        className: string;
        iconClassName: string;
    }
> = {
    pending: {
        label: "Verification Pending",
        description:
            "Your pharmacy registration is currently being reviewed by the SahiDawa administration team.",
        icon: Clock,
        className: "border-amber-200 bg-amber-50",
        iconClassName: "text-amber-600",
    },
    approved: {
        label: "Verified Pharmacy",
        description: "Your pharmacy has been verified by the SahiDawa administration team.",
        icon: CheckCircle,
        className: "border-green-200 bg-green-50",
        iconClassName: "text-green-600",
    },
    rejected: {
        label: "Registration Rejected",
        description:
            "Your pharmacy registration was not approved. Please contact the administration team for further information.",
        icon: XCircle,
        className: "border-red-200 bg-red-50",
        iconClassName: "text-red-600",
    },
};

export default function PartnerDashboardPage() {
    const { token, isLoading: authLoading } = useSession();

    const [claims, setClaims] = useState<MyPharmacyClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchClaims = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const result = await getMyPharmacyClaims();
            setClaims(result);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load pharmacy registration status."
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (!authLoading && token) {
            fetchClaims();
        }
    }, [authLoading, token, fetchClaims]);

    if (authLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                            <Store className="h-5 w-5" />
                        </div>

                        <div>
                            <h1 className="text-xl font-bold text-slate-900">
                                Pharmacy Registration
                            </h1>
                            <p className="text-sm text-slate-500">
                                Track your pharmacy verification status
                            </p>
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

            <main className="mx-auto max-w-5xl px-6 py-8">
                <div className="mb-6">
                    <Link
                        href="/partner"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Partner Portal
                    </Link>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading registration status...
                        </div>
                    </div>
                ) : claims.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                        <Store className="mx-auto mb-4 h-12 w-12 text-slate-300" />

                        <h2 className="text-lg font-semibold text-slate-900">
                            No Pharmacy Registrations
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                            You have not submitted a pharmacy registration request yet.
                        </p>

                        <Link
                            href="/partner"
                            className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            Register a Pharmacy
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {claims.map((claim) => {
                            const config = statusConfig[claim.status];
                            const StatusIcon = config.icon;
                            const pharmacy = claim.pharmacies;

                            return (
                                <div
                                    key={claim.id}
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                >
                                    <div className="border-b border-slate-100 px-6 py-5">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <Store className="h-5 w-5 text-blue-600" />

                                                    <h2 className="text-lg font-bold text-slate-900">
                                                        {pharmacy?.name ?? "Unknown Pharmacy"}
                                                    </h2>
                                                </div>

                                                <p className="mt-1 text-sm text-slate-500">
                                                    Registration submitted{" "}
                                                    {new Date(
                                                        claim.created_at
                                                    ).toLocaleDateString()}
                                                </p>
                                            </div>

                                            <span
                                                className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${config.className} ${config.iconClassName}`}
                                            >
                                                <StatusIcon className="h-4 w-4" />
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <div
                                            className={`mb-6 rounded-xl border p-4 ${config.className}`}
                                        >
                                            <div className="flex gap-3">
                                                <StatusIcon
                                                    className={`mt-0.5 h-5 w-5 shrink-0 ${config.iconClassName}`}
                                                />

                                                <div>
                                                    <p className="font-semibold text-slate-900">
                                                        {config.label}
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-600">
                                                        {config.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <DetailRow
                                                icon={FileText}
                                                label="Drug License Number"
                                                value={claim.drug_license_number}
                                            />

                                            <DetailRow
                                                icon={User}
                                                label="Owner"
                                                value={claim.owner_name}
                                            />

                                            <DetailRow
                                                icon={Phone}
                                                label="Contact Number"
                                                value={claim.phone_number}
                                            />

                                            <DetailRow
                                                icon={MapPin}
                                                label="Address"
                                                value={pharmacy?.address ?? "Not available"}
                                            />
                                        </div>

                                        {claim.status === "approved" && (
                                            <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
                                                <ShieldCheck className="h-6 w-6 text-green-600" />

                                                <div>
                                                    <p className="font-semibold text-green-800">
                                                        Verified Pharmacy
                                                    </p>

                                                    <p className="text-sm text-green-700">
                                                        Your pharmacy is now eligible to display the
                                                        SahiDawa verified badge.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
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
        <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
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
