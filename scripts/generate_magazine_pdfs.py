from pathlib import Path
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "magazine"
OUTPUT = ROOT / "output" / "pdf"
PAGE_W, PAGE_H = 595, 842

ISSUES = [
    ("all-2026-09-09", "05", "09 SEPTEMBER 2026", "ANANYA RAO", "ALL / #1 OVERALL", "THE COST OF BEING SEEN", "/ananya-rao-hero.webp", "charcoal", "84.6K", "18.2K"),
    ("building-2026-09-09", "04", "09 SEPTEMBER 2026", "ARJUN SEN", "BUILDING / #1", "BUILD BEFORE THEY BELIEVE", "/magazine/issue-01-blue.png", "blue", "26.4K", "6.1K"),
    ("the-rant-2026-09-09", "03", "09 SEPTEMBER 2026", "MAYA KHAN", "THE RANT / #1", "SAY THE QUIET PART OUT LOUD", "/magazine/issue-02-red.png", "red", "19.8K", "4.8K"),
    ("money-2026-09-09", "02", "09 SEPTEMBER 2026", "PRIYA MEHTA", "MONEY I SET ON FIRE / #1", "WHAT THE ROOM WILL PAY FOR", "/magazine/issue-03-orange.png", "orange", "17.1K", "4.1K"),
    ("unpopular-opinion-2026-09-09", "01", "09 SEPTEMBER 2026", "MARCUS REED", "UNPOPULAR OPINION / #1", "EVERY POINT HAS A PRICE", "/magazine/issue-04-green.png", "green", "15.3K", "3.6K"),
    ("beef-2026-09-09", "05", "09 SEPTEMBER 2026", "DEV ARORA", "BEEF / #1", "THE BEEF LEDGER", "/magazine/issue-02-red.png", "red", "14.8K", "3.4K"),
    ("chaos-2026-09-09", "06", "09 SEPTEMBER 2026", "LINA THOMAS", "CHAOS / #1", "THE CHAOS INDEX", "/magazine/issue-03-orange.png", "orange", "12.9K", "3.0K"),
    ("wrong-2026-09-09", "07", "09 SEPTEMBER 2026", "ROHAN SHAH", "I WAS WRONG / #1", "THE REVISION NOTE", "/magazine/issue-01-blue.png", "blue", "11.7K", "2.7K"),
    ("confessions-2026-09-09", "08", "09 SEPTEMBER 2026", "ADA KIM", "CONFESSIONS / #1", "THE PUBLIC ADMISSION", "/magazine/issue-04-green.png", "green", "10.8K", "2.5K"),
    ("pitch-2026-09-09", "09", "09 SEPTEMBER 2026", "SANJAY BOSE", "THE PITCH THAT GOT REJECTED / #1", "THE REJECTION FILE", "/magazine/issue-01-blue.png", "charcoal", "10.2K", "2.4K"),
    ("ask-2026-09-09", "10", "09 SEPTEMBER 2026", "CHLOE WU", "THE ASK / #1", "THE OPEN QUESTION", "/magazine/issue-02-red.png", "blue", "9.6K", "2.2K"),
    ("hiring-2026-09-09", "11", "09 SEPTEMBER 2026", "NEEL GUPTA", "HIRING / #1", "THE HIRING NOTE", "/magazine/issue-03-orange.png", "orange", "9.1K", "2.1K"),
    ("agency-row-2026-09-09", "12", "09 SEPTEMBER 2026", "LEILA HADDAD", "AGENCY ROW / #1", "THE AGENCY RECORD", "/magazine/issue-02-red.png", "red", "8.9K", "2.0K"),
    ("indian-d2c-2026-09-09", "13", "09 SEPTEMBER 2026", "RITESH JAIN", "INDIAN D2C / #1", "THE D2C RECEIPT", "/magazine/issue-04-green.png", "green", "8.4K", "1.9K"),
    ("all-2026-09-08", "04", "08 SEPTEMBER 2026", "KABIR MALIK", "ALL / #1 OVERALL", "THE PATIENCE TO HOLD", "/magazine/archive-2026-09-08.png", "blue", "126K", "21.4K"),
    ("all-2026-09-07", "03", "07 SEPTEMBER 2026", "NIA KAPOOR", "ALL / #1 OVERALL", "THE ROOM CHANGED ITS MIND", "/magazine/archive-2026-09-07.png", "red", "109K", "18.7K"),
    ("all-2026-09-06", "02", "06 SEPTEMBER 2026", "JULES REED", "ALL / #1 OVERALL", "DON'T ASK FOR THE ROOM", "/magazine/archive-2026-09-06.png", "green", "91K", "15.8K"),
    ("all-2026-09-05", "01", "05 SEPTEMBER 2026", "SOFIA DESAI", "ALL / #1 OVERALL", "THE FIRST RECORD", "/magazine/archive-2026-09-06.png", "charcoal", "76K", "13.4K"),
]

ACCENTS = {
    "charcoal": HexColor("#111111"),
    "blue": HexColor("#163f8f"),
    "red": HexColor("#841b2c"),
    "orange": HexColor("#9c4212"),
    "green": HexColor("#174d36"),
}


def draw_wrapped(c, text, x, y, max_width, font, size, leading, color):
    c.setFont(font, size)
    c.setFillColor(color)
    words = text.split()
    line = ""
    for word in words:
        proposed = f"{line} {word}".strip()
        if line and stringWidth(proposed, font, size) > max_width:
            c.drawString(x, y, line)
            y -= leading
            line = word
        else:
            line = proposed
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_cover_image(c, image_path, tone):
    c.setFillColor(ACCENTS[tone])
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    try:
        image = ImageReader(image_path)
        image_w, image_h = image.getSize()
        scale = max(PAGE_W / image_w, PAGE_H / image_h)
        draw_w, draw_h = image_w * scale, image_h * scale
        c.drawImage(image, (PAGE_W - draw_w) / 2, (PAGE_H - draw_h) / 2, draw_w, draw_h, mask="auto")
        c.setFillColor(Color(0, 0, 0, alpha=0.55))
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    except Exception:
        pass


def footer(c, number, page, color):
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.line(36, 32, PAGE_W - 36, 32)
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(36, 18, "BOUGHT / THE REVIEW")
    c.drawRightString(PAGE_W - 36, 18, f"ISSUE {number} / PAGE {page:02d}")


def draw_issue(path, issue):
    slug, number, date, person, category, title, image_rel, tone, views, opens = issue
    c = canvas.Canvas(str(path), pagesize=(PAGE_W, PAGE_H), author="BOUGHT")
    c.setTitle(f"BOUGHT Review - Issue {number}: {title}")
    c.setSubject("A three-page BOUGHT Review issue generated from verified public ladder data.")
    image_path = ROOT / "public" / image_rel.lstrip("/")

    draw_cover_image(c, image_path, tone)
    c.setFillColor(HexColor("#f7f4ed"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(36, PAGE_H - 38, "THE DAILY RECORD OF THE LADDER")
    c.drawRightString(PAGE_W - 36, PAGE_H - 38, date)
    c.setFont("Helvetica-Bold", 60)
    c.drawString(36, PAGE_H - 118, "BOUGHT")
    c.setFont("Times-Roman", 34)
    c.drawString(36, PAGE_H - 154, "THE REVIEW")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(36, 188, category)
    title_y = draw_wrapped(c, title, 36, 150, PAGE_W - 80, "Times-Roman", 39, 41, HexColor("#f7f4ed"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(36, max(53, title_y - 8), f"{person} / ISSUE {number}")
    c.showPage()

    paper = HexColor("#f1eee6")
    ink = HexColor("#171714")
    c.setFillColor(paper)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(36, PAGE_H - 42, "01 / THE POSITION")
    y = draw_wrapped(c, title, 36, PAGE_H - 102, PAGE_W - 72, "Times-Roman", 42, 43, ink)
    y -= 28
    copy = "This issue preserves the public position exactly as it was published. It is a record of the result, not an editorial profile written on behalf of the winner."
    y = draw_wrapped(c, copy, 36, y, PAGE_W - 85, "Times-Roman", 18, 23, ink)
    c.setStrokeColor(ink)
    c.line(36, 250, PAGE_W - 36, 250)
    facts = [("POSITION", category), ("ON THE COVER", person), ("PUBLISHED", date)]
    for index, (label, value) in enumerate(facts):
        x = 36 + index * 174
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x, 220, label)
        draw_wrapped(c, value, x, 199, 150, "Times-Roman", 14, 16, ink)
    c.setFont("Times-Italic", 19)
    draw_wrapped(c, "The title, rank, and approved public media are enough to make a durable issue. Extra bidder information is optional.", 36, 128, PAGE_W - 80, "Times-Italic", 19, 23, ink)
    footer(c, number, 2, ink)
    c.showPage()

    red = HexColor("#eb3435")
    c.setFillColor(red)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(HexColor("#090909"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(36, PAGE_H - 42, "02 / THE RECEIPT")
    draw_wrapped(c, "A record readers can return to.", 36, PAGE_H - 106, PAGE_W - 76, "Times-Roman", 43, 45, HexColor("#090909"))
    c.setStrokeColor(HexColor("#090909"))
    c.setLineWidth(1.2)
    c.line(36, 445, PAGE_W - 36, 445)
    c.line(36, 330, PAGE_W - 36, 330)
    stats = [(views, "ISSUE VIEWS"), (opens, "COVER OPENS"), (category.replace(" / #1", ""), "ROOM")]
    for index, (value, label) in enumerate(stats):
        x = 36 + index * 174
        c.setFont("Times-Roman", 31 if index < 2 else 15)
        draw_wrapped(c, value, x, 407, 150, "Times-Roman", 31 if index < 2 else 15, 18, HexColor("#090909"))
        c.setFont("Helvetica-Bold", 7)
        c.drawString(x, 375, label)
    receipt = "BOUGHT only prints information already approved for public publication: the title, category, final placement, timestamp, thumbnail or broadcast, and optional profile links. No questionnaire is needed to publish the issue."
    draw_wrapped(c, receipt, 36, 288, PAGE_W - 80, "Times-Roman", 19, 24, HexColor("#090909"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(36, 88, "AUTOMATIC ISSUE FORMAT / VERIFIED PUBLIC RECORD")
    footer(c, number, 3, HexColor("#090909"))
    c.save()


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for issue in ISSUES:
        slug = issue[0]
        for folder in (PUBLIC, OUTPUT):
            draw_issue(folder / f"{slug}.pdf", issue)


if __name__ == "__main__":
    main()
