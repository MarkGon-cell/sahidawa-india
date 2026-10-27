import sys
from pathlib import Path
import pymupdf


def render_pdf(pdf_path: str, output_dir: str) -> None:
    pdf_file = Path(pdf_path)
    output_path = Path(output_dir)

    if not pdf_file.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_file}")

    output_path.mkdir(parents=True, exist_ok=True)

    document = pymupdf.open(pdf_file)

    try:
        for page_number, page in enumerate(document):
            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(1, 1),
                alpha=False,
            )

            image_path = output_path / f"page_{page_number + 1}.png"
            pixmap.save(image_path)

            print(image_path)

    finally:
        document.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(
            "Usage: python render_pdf.py <pdf_path> <output_directory>"
        )
        sys.exit(1)

    render_pdf(sys.argv[1], sys.argv[2])