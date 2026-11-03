
from pathlib import Path
from uuid import uuid4
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    HRFlowable,
)


REPORT_DIR = Path("generated_reports")
REPORT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


def generate_pdf(
    title: str,
    briefing: str,
    analysis: str,
    verification: str,
) -> str:

    filename = f"{uuid4().hex}.pdf"
    filepath = REPORT_DIR / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=(595, 842),
        rightMargin=48,
        leftMargin=48,
        topMargin=48,
        bottomMargin=48,
    )

    styles = getSampleStyleSheet()
    styles["Title"].alignment = TA_CENTER

    elements = []

    elements.append(
        Paragraph(escape(title), styles["Title"])
    )

    elements.append(Spacer(1, 18))

    elements.append(
        HRFlowable(
            width="100%",
            thickness=1,
            color=colors.grey,
        )
    )

    sections = [
        ("Executive Summary", briefing),
        ("Geopolitical Analysis", analysis),
        ("Verification Notes", verification),
    ]

    for heading, content in sections:
        elements.append(Spacer(1, 20))
        elements.append(
            Paragraph(
                escape(heading),
                styles["Heading2"],
            )
        )

        for paragraph in content.split("\n"):
            if paragraph.strip():
                elements.append(
                    Paragraph(
                        escape(paragraph),
                        styles["BodyText"],
                    )
                )
                elements.append(Spacer(1, 8))

    doc.build(elements)

    return str(filepath)
