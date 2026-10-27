import { Router, Request, Response } from "express";
import multer from "multer";
import { getMlServiceUrl, getMlAuthHeaders } from "../config/mlService";
import { requireAuth } from "../middleware/auth";
import { scanQueryLimiter } from "../middleware/rateLimit";

const router = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG, and WEBP images are supported."));
        }
    },
});

/**
 * POST /api/v1/ai/pill-identifier
 *
 * Express receives the image from the frontend and forwards it
 * to the Python ML service.
 *
 * Flow:
 *
 * Browser
 *   ↓
 * Express API
 *   ↓ multipart/form-data
 * FastAPI ML service
 *   ↓
 * Ollama / qwen2.5vl:3b
 */
router.post(
    "",
    requireAuth,
    scanQueryLimiter,
    upload.single("file"),
    async (req: Request, res: Response) => {
        try {
            const mlServiceUrl = getMlServiceUrl();

            if (!mlServiceUrl) {
                return res.status(503).json({
                    success: false,
                    error: "ML service is not configured.",
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "No image file provided.",
                });
            }

            console.log("[Pill Identifier API] Received image:", req.file.originalname);

            console.log("[Pill Identifier API] Image type:", req.file.mimetype);

            console.log(
                "[Pill Identifier API] Image size:",
                `${(req.file.size / 1024).toFixed(1)} KB`
            );

            /*
             * Create multipart form data for the Python ML service.
             */
            const form = new FormData();

            const imageBytes = Uint8Array.from(req.file.buffer);

            const imageBlob = new Blob([imageBytes], {
                type: req.file.mimetype,
            });

            form.append("file", imageBlob, req.file.originalname || "pill-image.jpg");

            console.log("[Pill Identifier API] Sending image to ML service...");

            console.log("[Pill Identifier API] ML service:", mlServiceUrl);

            /*
             * Forward the request to FastAPI.
             *
             * IMPORTANT:
             * Do not manually set Content-Type here.
             * fetch() automatically creates the multipart boundary.
             */
            const mlResponse = await fetch(`${mlServiceUrl}/pill-identifier`, {
                method: "POST",
                headers: {
                    ...getMlAuthHeaders(),
                },
                body: form,
            });

            console.log("[Pill Identifier API] ML status:", mlResponse.status);

            const responseText = await mlResponse.text();

            if (!mlResponse.ok) {
                console.error("[Pill Identifier API] ML service error:", responseText);

                let errorMessage = responseText;

                try {
                    const errorJson = JSON.parse(responseText);

                    if (errorJson?.detail) {
                        errorMessage = errorJson.detail;
                    }
                } catch {
                    // Keep raw response text.
                }

                return res.status(mlResponse.status).json({
                    success: false,
                    error: errorMessage || "ML service request failed.",
                });
            }

            let result: unknown;

            try {
                result = JSON.parse(responseText);
            } catch (error) {
                console.error("[Pill Identifier API] Invalid ML JSON:", error);

                return res.status(502).json({
                    success: false,
                    error: "ML service returned invalid JSON.",
                });
            }

            console.log("[Pill Identifier API] ML analysis completed.");

            return res.status(200).json(result);
        } catch (error) {
            console.error("[Pill Identifier API] Error:", error);

            if (error instanceof multer.MulterError) {
                if (error.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({
                        success: false,
                        error: "Image must be smaller than 10 MB.",
                    });
                }

                return res.status(400).json({
                    success: false,
                    error: error.message,
                });
            }

            if (error instanceof Error) {
                if (error.message.includes("Only JPG, PNG, and WEBP")) {
                    return res.status(400).json({
                        success: false,
                        error: error.message,
                    });
                }
            }

            return res.status(500).json({
                success: false,
                error: "Unable to identify the medicine.",
            });
        }
    }
);

export default router;
