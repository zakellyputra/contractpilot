"""Tesseract OCR for scanned PDF documents.

Uses PyMuPDF to convert PDF pages to images, then pytesseract
for local OCR text extraction. No cloud API or credentials required.
"""

import concurrent.futures
import io

import fitz  # pymupdf
import pytesseract
from PIL import Image


def _ocr_single_page(page_bytes: bytes) -> str:
    """OCR a single page image using Tesseract."""
    image = Image.open(io.BytesIO(page_bytes))
    text = pytesseract.image_to_string(image, lang="eng")
    return text.strip()


def ocr_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a scanned PDF using Tesseract OCR.

    Args:
        pdf_bytes: Raw PDF file bytes.

    Returns:
        Full extracted text with page breaks.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Convert all pages to PNG at 200 DPI
    page_images = []
    for page in doc:
        pix = page.get_pixmap(dpi=200)
        page_images.append(pix.tobytes("png"))
    doc.close()

    # Process pages concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_ocr_single_page, img) for img in page_images]
        results = [f.result(timeout=60) for f in futures]

    return "\n\n".join(results)


def _ocr_single_page_with_data(
    page_bytes: bytes, page_index: int, page_width: float, page_height: float
) -> dict:
    """OCR a single page and return text + word bounding boxes.

    Coordinates are scaled from image pixels to PDF points.
    """
    image = Image.open(io.BytesIO(page_bytes))
    img_width, img_height = image.size

    scale_x = page_width / img_width
    scale_y = page_height / img_height

    data = pytesseract.image_to_data(image, lang="eng", output_type=pytesseract.Output.DICT)

    words = []
    text_parts = []
    n = len(data["text"])
    for i in range(n):
        word = data["text"][i].strip()
        conf = int(data["conf"][i]) if data["conf"][i] != "-1" else -1
        if not word or conf < 30:
            continue

        x = data["left"][i]
        y = data["top"][i]
        w = data["width"][i]
        h = data["height"][i]

        words.append({
            "text": word,
            "x0": x * scale_x,
            "y0": y * scale_y,
            "x1": (x + w) * scale_x,
            "y1": (y + h) * scale_y,
            "page": page_index,
        })
        text_parts.append(word)

    return {"text": " ".join(text_parts), "words": words}


def ocr_pdf_with_positions(pdf_bytes: bytes) -> tuple[str, list[dict]]:
    """Extract text and word positions from a scanned PDF.

    Args:
        pdf_bytes: Raw PDF file bytes.

    Returns:
        Tuple of (full_text, all_words) where all_words is a flat list of
        word dicts with {text, x0, y0, x1, y1, page} in PDF point coords.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    page_infos = []
    page_images = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=200)
        page_images.append(pix.tobytes("png"))
        page_infos.append({
            "index": i,
            "width": page.rect.width,
            "height": page.rect.height,
        })
    doc.close()

    all_words = []
    page_texts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(
                _ocr_single_page_with_data,
                page_images[info["index"]],
                info["index"],
                info["width"],
                info["height"],
            )
            for info in page_infos
        ]
        for f in futures:
            result = f.result(timeout=60)
            page_texts.append(result["text"])
            all_words.extend(result["words"])

    full_text = "\n\n".join(page_texts)
    return full_text, all_words
