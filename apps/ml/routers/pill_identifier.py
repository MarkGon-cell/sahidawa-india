import base64
import json
import os
import urllib.error
import urllib.request
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

router = APIRouter(
    prefix="/pill-identifier",
    tags=["Pill Identifier"],
)

OLLAMA_URL = os.getenv(
    "OLLAMA_URL",
    "http://127.0.0.1:11434",
).rstrip("/")

OLLAMA_MODEL = os.getenv(
    "OLLAMA_MODEL",
    "qwen2.5vl:3b",
)

MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


PILL_PROMPT = """
Identify the medicine shown in the image using visible evidence only.
Do not invent a medicine name or text. If uncertain, use Unknown.
Do not provide dosage or treatment advice.
Keep visibleText to at most 8 short items. Avoid repeating text.

Return only one valid JSON object with exactly these fields:
{
  "medicineName": "Name or Unknown",
  "strength": "Strength or Unknown",
  "confidence": 0,
  "visibleText": [],
  "visualDescription": "Brief description",
  "reasoning": "Brief explanation"
}

Confidence must be an integer from 0 to 100.
Close every JSON bracket. Do not include Markdown.
"""



def normalize_result(data: Any) -> dict:
    if not isinstance(data, dict):
        return {
            "medicineName": "Unknown",
            "strength": "Unknown",
            "confidence": 0,
            "visibleText": [],
            "visualDescription": "",
            "reasoning": str(data),
        }

    medicine_name = data.get(
        "medicineName",
        "Unknown",
    )

    strength = data.get(
        "strength",
        "Unknown",
    )

    confidence = data.get(
        "confidence",
        0,
    )

    visible_text = data.get(
        "visibleText",
        [],
    )

    visual_description = data.get(
        "visualDescription",
        "",
    )

    reasoning = data.get(
        "reasoning",
        "",
    )

    if not isinstance(medicine_name, str):
        medicine_name = "Unknown"

    if not isinstance(strength, str):
        strength = "Unknown"

    try:
        confidence = float(confidence)
    except (TypeError, ValueError):
        confidence = 0

    confidence = max(
        0,
        min(100, confidence),
    )

    if not isinstance(visible_text, list):
        visible_text = []

    visible_text = [
        str(item)
        for item in visible_text[:20]
    ]

    if not isinstance(
        visual_description,
        str,
    ):
        visual_description = ""

    if not isinstance(
        reasoning,
        str,
    ):
        reasoning = ""

    return {
        "medicineName": (
            medicine_name.strip()
            or "Unknown"
        ),
        "strength": (
            strength.strip()
            or "Unknown"
        ),
        "confidence": confidence,
        "visibleText": visible_text,
        "visualDescription": visual_description,
        "reasoning": reasoning,
    }




def parse_model_response(response_text: str) -> dict:
    import re

    text = response_text.strip()

    # Remove Markdown fences.
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    # Prefer a complete, valid JSON object.
    try:
        return normalize_result(json.loads(text))
    except json.JSONDecodeError:
        pass

    # Recover fields from truncated JSON when possible.
    def get_string(key: str, default: str = "Unknown") -> str:
        match = re.search(
            rf'"{re.escape(key)}"\s*:\s*"((?:\\.|[^"\\])*)"',
            text,
        )
        if not match:
            return default
        try:
            return json.loads('"' + match.group(1) + '"')
        except json.JSONDecodeError:
            return match.group(1)

    confidence_match = re.search(
        r'"confidence"\s*:\s*(\d+(?:\.\d+)?)',
        text,
    )

    visible_match = re.search(
        r'"visibleText"\s*:\s*\[(.*?)\]',
        text,
        re.DOTALL,
    )

    visible_text = []
    if visible_match:
        visible_text = re.findall(
            r'"((?:\\.|[^"\\])*)"',
            visible_match.group(1),
        )
        visible_text = [
            item for item in visible_text[:8]
        ]

    result = {
        "medicineName": get_string("medicineName"),
        "strength": get_string("strength"),
        "confidence": (
            float(confidence_match.group(1))
            if confidence_match
            else 0
        ),
        "visibleText": visible_text,
        "visualDescription": get_string(
            "visualDescription", ""
        ),
        "reasoning": get_string("reasoning", ""),
    }

    # Don't treat an unparseable response as a successful identification.
    if (
        result["medicineName"] == "Unknown"
        and result["strength"] == "Unknown"
    ):
        result["confidence"] = 0

    return normalize_result(result)



def call_ollama(
    image_base64: str,
) -> dict:
    payload = {
    "model": OLLAMA_MODEL,
    "prompt": PILL_PROMPT,
    "images": [image_base64],
    "stream": False,
    "format": "json",
    "options": {
        "num_ctx": 8192,
        "num_predict": 300,
        "temperature": 0,
    },
}

    body = json.dumps(
        payload
    ).encode("utf-8")

    request = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=body,
        headers={
            "Content-Type":
                "application/json",
        },
        method="POST",
    )

    print(
        "[Pill Identifier ML] "
        "Sending request to Ollama..."
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=120,
        ) as response:

            response_body = (
                response
                .read()
                .decode("utf-8")
            )

    except urllib.error.HTTPError as error:
        error_body = ""

        try:
            error_body = (
                error
                .read()
                .decode("utf-8")
            )
        except Exception:
            pass

        print(
            "[Pill Identifier ML] "
            "Ollama HTTP error:",
            error.code,
            error_body,
        )

        raise HTTPException(
            status_code=502,
            detail="Ollama returned an error.",
        )

    except urllib.error.URLError as error:
        print(
            "[Pill Identifier ML] "
            "Cannot connect to Ollama:",
            error,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Cannot connect to Ollama. "
                "Make sure Ollama is running."
            ),
        )

    except TimeoutError as error:
        print(
            "[Pill Identifier ML] "
            "Ollama timeout:",
            error,
        )

        raise HTTPException(
            status_code=504,
            detail=(
                "Ollama took too long to "
                "analyze the image."
            ),
        )

    try:
        ollama_data = json.loads(
            response_body
        )

    except json.JSONDecodeError:
        print(
            "[Pill Identifier ML] "
            "Invalid Ollama JSON:",
            response_body,
        )

        raise HTTPException(
            status_code=502,
            detail=(
                "Ollama returned invalid JSON."
            ),
        )

    model_response = ollama_data.get(
        "response",
        "",
    )

    if not isinstance(
        model_response,
        str,
    ):
        raise HTTPException(
            status_code=502,
            detail=(
                "Ollama returned an invalid "
                "model response."
            ),
        )

    print(
        "[Pill Identifier ML] "
        "Model response:",
        model_response,
    )

    return parse_model_response(
        model_response,
    )


@router.post("")
async def identify_pill(
    file: UploadFile = File(...),
):
    if not file.content_type:
        raise HTTPException(
            status_code=400,
            detail=(
                "Image type could not "
                "be determined."
            ),
        )

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG, and WEBP "
                "images are supported."
            ),
        )

    image_bytes = await file.read()

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                "Image must be smaller "
                "than 10 MB."
            ),
        )

    print(
        "[Pill Identifier ML] Received:",
        file.filename,
    )

    print(
        "[Pill Identifier ML] Size:",
        f"{len(image_bytes) / 1024:.1f} KB",
    )

    image_base64 = (
        base64
        .b64encode(image_bytes)
        .decode("utf-8")
    )

    print(
        "[Pill Identifier ML] Model:",
        OLLAMA_MODEL,
    )

    result = call_ollama(
        image_base64,
    )

    result["disclaimer"] = (
        "AI identification is a best guess "
        "and must be verified by a pharmacist "
        "or qualified healthcare professional."
    )

    return {
        "success": True,
        "result": result,
    }