import { Router, Request, Response } from "express";
import multer from "multer";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAuth } from "../middleware/auth";
import { scanQueryLimiter } from "../middleware/rateLimit";

const router = Router();

const execFileAsync = promisify(execFile);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const OLLAMA_URL = process.env.OLLAMA_URL?.trim() || "http://localhost:11434";

const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || "qwen2.5vl:3b";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
            return;
        }

        cb(
            Object.assign(
                new Error("Unsupported file type. Please upload a JPG, PNG, WEBP image or PDF."),
                { code: "INVALID_MIME" }
            )
        );
    },
});

const LAB_ANALYZER_PROMPT = `
You are an AI assistant that extracts information from laboratory reports.

Analyze the supplied laboratory report image(s) carefully.

Return ONLY valid JSON matching this exact structure:

{
  "tests": [
    {
      "testName": "string",
      "userValue": "string",
      "referenceRange": "string",
      "status": "Low",
      "simpleExplanation": "string"
    }
  ],
  "summary": "string"
}

Rules:

1. Extract measurable laboratory tests that are clearly visible.

2. Preserve the test name from the report. Normalize spelling only when
   necessary for clarity.

3. Preserve the patient's reported value exactly, including decimals,
   symbols, units and qualitative values such as Negative, Positive, NIL,
   Trace, 1+, etc.

4. Use the reference interval or reference value printed on THIS report.

5. NEVER invent a reference range.

6. Compare the patient's value against the reference range printed on the
   report.

7. For numeric values:
   - Below the stated reference range = Low.
   - Within the stated reference range = Normal.
   - Above the stated reference range = High.

8. For qualitative tests:
   - If the patient's result matches the stated reference value, use Normal.
   - If the patient's result is outside the stated reference value, use
     High to represent an abnormal/above-normal result when the schema does
     not provide a separate Abnormal category.
   - Do not call a positive result Normal when the report states Negative
     as the reference value.

9. Example:
   If urine pH is 5.5 and the report states 6.0 - 8.0, the status MUST be
   Low.

10. Example:
    If urine glucose is 1+ and the report states Negative, the status MUST
    be High rather than Normal.

11. If a test value or reference range cannot be read reliably, omit that
    test rather than guessing.

12. Do not diagnose diseases or medical conditions.

13. Do not recommend medications or treatment.

14. Do not infer medical conditions from individual results.

15. simpleExplanation must be short, factual and understandable to a
    non-medical person.

16. The summary must describe what was found in the report without making
    a diagnosis.

17. Mention that abnormal results can have multiple possible causes and
    should be discussed with a qualified healthcare professional.

18. Use English.

19. Return ONLY JSON. Do not return Markdown, tables, explanations outside
    the JSON object, or code fences.
`;

function isLabResult(value: unknown): value is {
    tests: Array<{
        testName: string;
        userValue: string;
        referenceRange: string;
        status: "Low" | "Normal" | "High";
        simpleExplanation: string;
    }>;
    summary: string;
} {
    if (!value || typeof value !== "object") {
        return false;
    }

    const data = value as Record<string, unknown>;

    if (!Array.isArray(data.tests) || typeof data.summary !== "string") {
        return false;
    }

    return data.tests.every((test) => {
        if (!test || typeof test !== "object") {
            return false;
        }

        const item = test as Record<string, unknown>;

        return (
            typeof item.testName === "string" &&
            typeof item.userValue === "string" &&
            typeof item.referenceRange === "string" &&
            typeof item.simpleExplanation === "string" &&
            ["Low", "Normal", "High"].includes(String(item.status))
        );
    });
}

function normalizeLabResult(value: unknown): unknown {
    if (!value || typeof value !== "object") {
        return value;
    }

    const data = value as {
        tests?: Array<Record<string, unknown>>;
        summary?: unknown;
    };

    if (!Array.isArray(data.tests)) {
        return value;
    }

    return {
        ...data,
        tests: data.tests.map((test) => ({
            ...test,
            status: test.status === "NIL" ? "Normal" : test.status,
        })),
    };
}

async function renderPdfToImages(pdfBuffer: Buffer, workingDirectory: string): Promise<string[]> {
    const pdfPath = path.join(workingDirectory, "report.pdf");
    const outputDirectory = path.join(workingDirectory, "pages");

    await fs.mkdir(outputDirectory, {
        recursive: true,
    });

    await fs.writeFile(pdfPath, pdfBuffer);

    const pythonScript = path.resolve(process.cwd(), "..", "ml", "render_pdf.py");

    let pythonCommand = "python";
    let pythonArgs: string[] = [];

    if (process.platform === "win32") {
        pythonCommand = "py";
        pythonArgs = ["-3.11"];
    }

    await execFileAsync(pythonCommand, [...pythonArgs, pythonScript, pdfPath, outputDirectory], {
        maxBuffer: 10 * 1024 * 1024,
    });

    const files = await fs.readdir(outputDirectory);

    return files
        .filter((file) => /^page_\d+\.png$/i.test(file))
        .sort((a, b) => {
            const pageA = Number(a.match(/\d+/)?.[0] || 0);
            const pageB = Number(b.match(/\d+/)?.[0] || 0);

            return pageA - pageB;
        })
        .map((file) => path.join(outputDirectory, file));
}

async function getImageBuffers(
    file: Express.Multer.File,
    workingDirectory: string
): Promise<Buffer[]> {
    if (file.mimetype === "application/pdf") {
        const imagePaths = await renderPdfToImages(file.buffer, workingDirectory);

        const images: Buffer[] = [];

        for (const imagePath of imagePaths) {
            images.push(await fs.readFile(imagePath));
        }

        return images;
    }

    return [file.buffer];
}

async function analyzeWithOllama(imageBuffers: Buffer[]): Promise<unknown> {
    const CONCURRENCY = 3;

    const analyzePage = async (
        imageBuffer: Buffer,
        pageNumber: number
    ): Promise<{
        pageNumber: number;
        result: {
            tests: Array<Record<string, unknown>>;
            summary: string;
        };
    } | null> => {
        console.log(`[Lab Analyzer] Analyzing page ${pageNumber}/${imageBuffers.length}...`);

        const image = imageBuffer.toString("base64");

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: LAB_ANALYZER_PROMPT,
                images: [image],
                stream: false,
                format: "json",
                options: {
                    num_ctx: 32768,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(
                `Ollama request failed for page ${pageNumber}: ${response.status} ${errorText}`
            );
        }

        const data = await response.json();

        if (!data.response) {
            throw new Error(`Ollama returned an empty response for page ${pageNumber}`);
        }

        let parsedPage: unknown;

        try {
            parsedPage = JSON.parse(data.response);
        } catch {
            throw new Error(`Ollama returned invalid JSON for page ${pageNumber}`);
        }

        if (!isLabResult(parsedPage)) {
            console.error(`[Lab Analyzer] Invalid result from page ${pageNumber}:`, parsedPage);

            return null;
        }

        console.log(
            `[Lab Analyzer] Page ${pageNumber} completed. Found ${parsedPage.tests.length} test(s).`
        );

        return {
            pageNumber,
            result: parsedPage,
        };
    };

    const results: Array<{
        pageNumber: number;
        result: {
            tests: Array<Record<string, unknown>>;
            summary: string;
        };
    }> = [];

    // Process pages in batches of 3
    for (let start = 0; start < imageBuffers.length; start += CONCURRENCY) {
        const batch = imageBuffers.slice(start, start + CONCURRENCY);

        console.log(
            `[Lab Analyzer] Starting batch: pages ${start + 1}-${Math.min(
                start + CONCURRENCY,
                imageBuffers.length
            )}`
        );

        const batchResults = await Promise.all(
            batch.map((imageBuffer, index) => analyzePage(imageBuffer, start + index + 1))
        );

        for (const result of batchResults) {
            if (result) {
                results.push(result);
            }
        }

        console.log(
            `[Lab Analyzer] Batch completed. Processed ${Math.min(
                start + CONCURRENCY,
                imageBuffers.length
            )}/${imageBuffers.length} pages.`
        );
    }

    // Keep pages in their original order
    results.sort((a, b) => a.pageNumber - b.pageNumber);

    const allTests = results.flatMap((result) => result.result.tests);

    const summaries = results.map((result) => result.result.summary).filter(Boolean);

    console.log(`[Lab Analyzer] All pages processed. Total tests found: ${allTests.length}`);

    return {
        tests: allTests,
        summary:
            summaries.length > 0
                ? summaries.join(" ")
                : "No laboratory results could be extracted from the report.",
    };
}

router.post(
    "/",
    requireAuth,
    scanQueryLimiter,
    upload.single("file"),
    async (req: Request, res: Response): Promise<void> => {
        let workingDirectory: string | undefined;

        try {
            if (!req.file?.buffer) {
                res.status(400).json({
                    error: "Please upload a laboratory report.",
                });
                return;
            }

            /*
             * Create a temporary directory for PDF rendering.
             */
            workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "sahidawa-lab-analyzer-"));

            /*
             * Convert PDFs into images or use the uploaded
             * image directly.
             */
            const imageBuffers = await getImageBuffers(req.file, workingDirectory);

            if (imageBuffers.length === 0) {
                res.status(400).json({
                    error: "Unable to read the laboratory report.",
                });
                return;
            }

            console.log(
                `[Lab Analyzer] Sending ${imageBuffers.length} image(s) to Ollama model ${OLLAMA_MODEL}`
            );

            /*
             * Analyze the report locally using Ollama.
             */
            console.log("[Lab Analyzer] Calling Ollama...");

            const rawParsed = await analyzeWithOllama(imageBuffers);
            const parsed = normalizeLabResult(rawParsed);
            console.log("[Lab Analyzer] Ollama response received.");
            console.log("[Lab Analyzer] Valid result:", isLabResult(parsed));

            /*
             * Validate the AI response before returning
             * it to the frontend.
             */
            if (!isLabResult(parsed)) {
                console.error(
                    "[Lab Analyzer] Ollama returned an invalid result structure:",
                    parsed
                );

                if (!res.headersSent) {
                    res.status(502).json({
                        error: "The AI returned an incomplete laboratory analysis.",
                    });
                }

                return;
            }

            /*
             * Return the same response format used by
             * the existing Lab Analyzer frontend.
             */
            console.log("[Lab Analyzer] Before sending response. headersSent:", res.headersSent);

            if (!res.headersSent) {
                console.log("[Lab Analyzer] Sending successful response to frontend.");

                res.status(200).json({
                    success: true,
                    ...parsed,
                    disclaimer:
                        "This is an AI-generated summary, not a medical diagnosis. Always consult your doctor.",
                });

                console.log("[Lab Analyzer] Successful response sent.");
            } else {
                console.error("[Lab Analyzer] Response was already sent before successful result.");
            }
        } catch (error) {
            console.error("[Lab Analyzer] Analysis failed:", error);

            if (res.headersSent) {
                return;
            }

            res.status(500).json({
                error: "Unable to analyze the laboratory report. Please try again.",
            });
        } finally {
            /*
             * Delete temporary PDF/image files.
             */
            if (workingDirectory) {
                await fs
                    .rm(workingDirectory, {
                        recursive: true,
                        force: true,
                    })
                    .catch((cleanupError) => {
                        console.error(
                            "[Lab Analyzer] Temporary file cleanup failed:",
                            cleanupError
                        );
                    });
            }
        }
    }
);

export default router;
