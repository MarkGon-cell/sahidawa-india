import { z } from "zod";

export const PharmacyPartnerRegistrationSchema = z.object({
    pharmacy_name: z.string().min(2, "Pharmacy name must be at least 2 characters"),
    pharmacist_name: z.string().min(2, "Pharmacist name must be at least 2 characters"),
    license_number: z.string().min(5, "License number is required"),
    phone_number: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10-digit phone number"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    address: z.string().min(5, "Address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    pincode: z.string().regex(/^[0-9]{6}$/, "Must be a valid 6-digit pincode"),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
});

export type PharmacyPartnerRegistrationInput = z.infer<typeof PharmacyPartnerRegistrationSchema>;
export const PharmacyClaimSchema = z.object({
    pharmacy_id: z.string().uuid("Invalid pharmacy ID"),
    drug_license_number: z
        .string()
        .trim()
        .regex(/^\d{20}$/, "Drug License Number must contain exactly 20 digits"),
    owner_name: z
        .string()
        .trim()
        .min(2, "Owner name must be at least 2 characters")
        .max(150, "Owner name is too long"),
    phone_number: z
        .string()
        .trim()
        .regex(/^\+?[0-9\s\-()]{7,15}$/, "Invalid phone number"),
});

export type PharmacyClaimInput = z.infer<typeof PharmacyClaimSchema>;
