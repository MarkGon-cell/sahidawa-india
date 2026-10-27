"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PharmacyClaimSchema, type PharmacyClaimInput } from "@sahidawa/validators";
import {
    searchPharmacies,
    submitPharmacyClaim,
    type PharmacySearchResult,
} from "../../../lib/api/partner";
import { PageHeader } from "../components/PageHeader";
import {
    Store,
    CheckCircle,
    AlertCircle,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Users,
    ArrowRight,
} from "lucide-react";

export default function PartnerRegistrationPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [pharmacyQuery, setPharmacyQuery] = useState("");
    const [pharmacyResults, setPharmacyResults] = useState<PharmacySearchResult[]>([]);
    const [selectedPharmacy, setSelectedPharmacy] = useState<PharmacySearchResult | null>(null);
    const [searchingPharmacies, setSearchingPharmacies] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<PharmacyClaimInput>({
        resolver: zodResolver(PharmacyClaimSchema),
        defaultValues: {
            pharmacy_id: "",
            drug_license_number: "",
            owner_name: "",
            phone_number: "",
        },
    });

    const onSubmit = async (data: PharmacyClaimInput) => {
        setIsSubmitting(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            if (!selectedPharmacy) {
                setErrorMessage("Please select a pharmacy before submitting.");
                return;
            }

            const result = await submitPharmacyClaim({
                ...data,
                pharmacy_id: selectedPharmacy.id,
            });

            if (result.success) {
                setSuccessMessage(result.message || "Pharmacy claim submitted successfully.");
            } else {
                setErrorMessage(result.error || "Failed to submit pharmacy claim.");
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "Something went wrong.");
        } finally {
            setIsSubmitting(false);
        }
    };
    useEffect(() => {
        const query = pharmacyQuery.trim();

        if (query.length < 2) {
            setPharmacyResults([]);
            return;
        }

        const controller = new AbortController();

        const search = async () => {
            setSearchingPharmacies(true);

            try {
                const results = await searchPharmacies(query, controller.signal);
                setPharmacyResults(results);
            } catch (err) {
                if (!controller.signal.aborted) {
                    console.error("Pharmacy search failed:", err);
                    setPharmacyResults([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSearchingPharmacies(false);
                }
            }
        };

        const timeout = setTimeout(search, 300);

        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [pharmacyQuery]);

    if (successMessage) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50/30 text-(--color-text-primary) dark:from-slate-950 dark:to-slate-900">
                <PageHeader backHref="/" variant="light" hideBackButton />
                <div className="mx-auto max-w-2xl px-4 py-24 text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <CheckCircle className="h-12 w-12" />
                    </div>
                    <h1 className="mb-4 text-4xl font-extrabold tracking-tight">
                        Registration Received!
                    </h1>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-6 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                        <p className="text-lg font-medium text-emerald-800 dark:text-emerald-300">
                            {successMessage}
                        </p>
                    </div>
                    <p className="mx-auto mt-6 max-w-md text-(--color-text-secondary)">
                        Our compliance team will verify your Drug License certificate details. You
                        will receive an SMS and Email confirmation once approved.
                    </p>
                    <div className="mt-8 flex justify-center gap-4">
                        <a
                            href="/"
                            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                        >
                            Return Home
                        </a>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-(--color-text-primary) dark:from-slate-950 dark:to-slate-900">
            <PageHeader backHref="/" variant="light" hideBackButton />

            {/* Header section with modern background */}
            <div className="relative overflow-hidden bg-slate-900 py-16 text-white dark:bg-black">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_40%)]" />
                <div className="relative z-10 mx-auto max-w-6xl px-4">
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400">
                            <Store className="h-6 w-6" />
                        </span>
                        <span className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">
                            SahiDawa Partner network
                        </span>
                    </div>
                    <h1 className="text-center text-4xl font-black tracking-tight sm:text-5xl">
                        Grow Your Pharmacy, <span className="text-emerald-400">Digitally</span>
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-center text-lg text-slate-300">
                        Register as a verified pharmacy partner to list generic stock, display your
                        verified badge, and connect directly with local patients.
                    </p>
                </div>
            </div>

            <section className="mx-auto max-w-6xl px-4 py-16">
                <div className="grid items-start gap-12 lg:grid-cols-12">
                    {/* Left Column: Benefits & Trust elements */}
                    <div className="space-y-8 lg:col-span-5">
                        <div>
                            <h2 className="mb-2 text-2xl font-bold">Why partner with SahiDawa?</h2>
                            <p className="text-(--color-text-secondary)">
                                We bridge the gap between rural/urban patients looking for
                                affordable, high-quality generic substitutions and verified local
                                chemists.
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <Users className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Acquire New Customers</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Get discovered by patients looking for specific generic
                                        alternatives (Jan Aushadhi equivalents) right in your
                                        neighborhood.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <ShieldCheck className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Verified Partner Badge</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Stand out on SahiDawa's interactive map with a verified
                                        green badge, building ultimate trust with patients.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <TrendingUp className="h-6 w-6" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-bold">Upload Stock & Pricing</h3>
                                    <p className="mt-1 text-sm text-(--color-text-secondary)">
                                        Upload your medicine inventories via CSV to let nearby users
                                        know what is in stock in real-time.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold tracking-wider text-(--color-text-muted) uppercase">
                                <Sparkles className="h-4 w-4 text-amber-500" /> Free Registration
                            </h4>
                            <p className="text-sm text-(--color-text-secondary)">
                                Listing on SahiDawa is 100% free. We do not charge commissions or
                                subscription fees. Our mission is to democratize generic healthcare
                                in India.
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Registration Form */}
                    <div className="lg:col-span-7">
                        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10 dark:border-slate-800/80 dark:bg-slate-900">
                            <div className="mb-8">
                                <h3 className="text-xl font-bold">Apply for Verification</h3>
                                <p className="mt-1 text-sm text-(--color-text-secondary)">
                                    Fields marked with (*) are required
                                </p>
                            </div>

                            {errorMessage && (
                                <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200/50 bg-red-50 p-4 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                                    <AlertCircle className="h-5 w-5 shrink-0" />
                                    <p className="text-sm font-medium">{errorMessage}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                {/* Step 1: Select Pharmacy */}
                                <div>
                                    <div className="mb-4 flex items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                            1
                                        </span>
                                        <div>
                                            <h4 className="font-bold">Select Your Pharmacy</h4>
                                            <p className="text-xs text-(--color-text-secondary)">
                                                Search and select the pharmacy you want to claim.
                                            </p>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        value={pharmacyQuery}
                                        onChange={(e) => {
                                            setPharmacyQuery(e.target.value);
                                            setSelectedPharmacy(null);
                                            setValue("pharmacy_id", "");
                                        }}
                                        placeholder="Search pharmacy by name..."
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                    />

                                    {searchingPharmacies && (
                                        <p className="mt-2 text-xs text-(--color-text-secondary)">
                                            Searching pharmacies...
                                        </p>
                                    )}

                                    {pharmacyResults.length > 0 && !selectedPharmacy && (
                                        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
                                            {pharmacyResults.map((pharmacy) => (
                                                <button
                                                    key={pharmacy.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPharmacy(pharmacy);
                                                        setPharmacyQuery(pharmacy.name);
                                                        setPharmacyResults([]);
                                                        setValue("pharmacy_id", pharmacy.id, {
                                                            shouldValidate: true,
                                                        });
                                                    }}
                                                    className="block w-full border-b border-slate-100 p-4 text-left transition-colors last:border-b-0 hover:bg-emerald-50 dark:border-slate-800 dark:hover:bg-slate-900"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="font-semibold">
                                                                {pharmacy.name}
                                                            </p>
                                                            <p className="mt-1 text-xs text-(--color-text-secondary)">
                                                                {pharmacy.address}
                                                            </p>
                                                            <p className="mt-1 text-xs text-(--color-text-secondary)">
                                                                {pharmacy.district},{" "}
                                                                {pharmacy.state}
                                                            </p>
                                                        </div>

                                                        {pharmacy.is_verified && (
                                                            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {pharmacyQuery.trim().length >= 2 &&
                                        !searchingPharmacies &&
                                        pharmacyResults.length === 0 &&
                                        !selectedPharmacy && (
                                            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-(--color-text-secondary) dark:bg-slate-900">
                                                No matching pharmacy found. Please check the
                                                spelling or contact an administrator to register a
                                                new pharmacy.
                                            </p>
                                        )}

                                    {selectedPharmacy && (
                                        <div className="mt-3 flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                                            <div>
                                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                                    SELECTED PHARMACY
                                                </p>
                                                <p className="mt-1 font-bold">
                                                    {selectedPharmacy.name}
                                                </p>
                                                <p className="mt-1 text-xs text-(--color-text-secondary)">
                                                    {selectedPharmacy.address}
                                                </p>
                                            </div>

                                            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
                                        </div>
                                    )}

                                    {errors.pharmacy_id && (
                                        <p className="mt-1 text-xs text-red-500">
                                            {errors.pharmacy_id.message}
                                        </p>
                                    )}
                                </div>

                                {/* Step 2: Verification Details */}
                                <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                                    <div className="mb-4 flex items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                            2
                                        </span>
                                        <div>
                                            <h4 className="font-bold">Verification Details</h4>
                                            <p className="text-xs text-(--color-text-secondary)">
                                                Provide the details from your pharmacy license.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                Drug License Number *
                                            </label>
                                            <input
                                                {...register("drug_license_number")}
                                                placeholder="e.g. DL-12345-XX"
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                            />
                                            {errors.drug_license_number && (
                                                <p className="mt-1 text-xs text-red-500">
                                                    {errors.drug_license_number.message}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                Owner Name *
                                            </label>
                                            <input
                                                {...register("owner_name")}
                                                placeholder="Enter pharmacy owner name"
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                            />
                                            {errors.owner_name && (
                                                <p className="mt-1 text-xs text-red-500">
                                                    {errors.owner_name.message}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                Phone Number *
                                            </label>
                                            <input
                                                {...register("phone_number")}
                                                type="tel"
                                                inputMode="tel"
                                                placeholder="10-digit mobile number"
                                                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition-all outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-950 dark:focus:bg-slate-900"
                                            />
                                            {errors.phone_number && (
                                                <p className="mt-1 text-xs text-red-500">
                                                    {errors.phone_number.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3: Submit */}
                                <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
                                    <div className="mb-4 flex items-center gap-3">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                            3
                                        </span>
                                        <div>
                                            <h4 className="font-bold">Submit for Verification</h4>
                                            <p className="text-xs text-(--color-text-secondary)">
                                                Our team will review your submitted details.
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !selectedPharmacy}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-500 focus:ring-4 focus:ring-emerald-500/20 focus:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSubmitting
                                            ? "Submitting Claim..."
                                            : "Submit for Verification"}

                                        {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
