import io
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class PDFDossierExporter:
    """
    Renders audit summaries, evaluated risks, and Q&A dialogue into printable PDF reports.
    """

    @staticmethod
    def sanitize_text(text: str) -> str:
        if not text:
            return ""

        # Normalize special symbols and unicode characters
        text = text.replace("§", "Sec. ")
        for h_char in ["\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2015", "\xad"]:
            text = text.replace(h_char, "-")
        for sp_char in ["\u200b", "\u200c", "\u200d", "\ufeff", "\u2060"]:
            text = text.replace(sp_char, "")
        for sq_char in ["■", "▪", "●", "◆", "\u25a0", "\u25aa", "\u25cf"]:
            text = text.replace(sq_char, "-")
        text = text.replace("\xa0", " ")

        # Format code blocks for ReportLab font rendering
        def format_code_block(match):
            code_content = match.group(1).strip()
            code_content = code_content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>&nbsp;&nbsp;")
            return f'<br/><font face="Courier" color="#9A3412"><b>&nbsp;&nbsp;{code_content}</b></font><br/>'

        text = re.sub(r'```(?:[a-zA-Z0-9_-]+)?\n?(.*?)\n?```', format_code_block, text, flags=re.DOTALL)

        # Escape standard HTML entities
        text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        text = text.replace("&lt;br/&gt;", "<br/>")
        text = text.replace('&lt;font face="Courier" color="#9A3412"&gt;', '<font face="Courier" color="#9A3412">')
        text = text.replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>").replace("&lt;/font&gt;", "</font>")

        # Transform markdown structures into XML paragraph tags
        text = re.sub(r'^[ \t]*(?:---|\*\*\*|___)[ \t]*$', r'<br/><font color="#CBD5E1">───────────────────────────────────────────────────</font><br/>', text, flags=re.MULTILINE)
        text = re.sub(r'^[ \t]*#{1,4}[ \t]+(.+)$', r'<br/><b><font color="#0F172A">\1</font></b><br/>', text, flags=re.MULTILINE)
        text = re.sub(r'^[ \t]*[-*+][ \t]+', r'&bull; ', text, flags=re.MULTILINE)
        text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
        text = re.sub(r'__(.+?)__', r'<b>\1</b>', text)
        text = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'<i>\1</i>', text)
        text = re.sub(r'(?<!_)_([^_]+?)_(?!_)', r'<i>\1</i>', text)
        text = re.sub(r'`([^`]+?)`', r'<font face="Courier" color="#9A3412"><b>\1</b></font>', text)
        text = re.sub(r'\[((?:Section|Sec\.?|Page|p\.?|Schedule|Clause|\b\d+\b)[^\]]*)\]', r'<font color="#C2410C"><b>[\1]</b></font>', text)

        text = text.replace("\n", "<br/>")
        text = re.sub(r'(?:<br/>\s*){3,}', '<br/><br/>', text)
        return text.strip()

    def generate_dossier(
        self,
        session_title: str,
        doc_name: str,
        messages: list,
        risk_analysis: list = None,
        missing_clauses: list = None
    ) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=18, leading=22, textColor=colors.HexColor("#0F172A"))
        subtitle_style = ParagraphStyle('Sub', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor("#64748B"), leading=13)
        section_h2 = ParagraphStyle('SecH2', parent=styles['Heading2'], fontSize=13, leading=17, textColor=colors.HexColor("#1E293B"), spaceBefore=10, spaceAfter=6)
        
        user_header = ParagraphStyle('UserH', parent=styles['Heading3'], fontSize=10, textColor=colors.HexColor("#C2410C"), leading=14)
        assistant_header = ParagraphStyle('AsstH', parent=styles['Heading3'], fontSize=10, textColor=colors.HexColor("#0F766E"), leading=14)
        body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=8.5, leading=12.5, textColor=colors.HexColor("#334155"))
        clause_title_style = ParagraphStyle('ClauseTitle', parent=styles['Normal'], fontSize=9.5, leading=13, textColor=colors.HexColor("#0F172A"))
        excerpt_style = ParagraphStyle('Excerpt', parent=styles['Normal'], fontSize=8, leading=11, fontName="Courier", textColor=colors.HexColor("#475569"))
        citation_badge = ParagraphStyle('CiteBadge', parent=styles['Normal'], fontSize=7.5, leading=10, textColor=colors.HexColor("#C2410C"))

        story = []

        # Document header
        story.append(Paragraph("LexiAudit AI — Contract Audit &amp; Dialogue Dossier", title_style))
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Session:</b> {session_title} &nbsp;|&nbsp; <b>Contract:</b> {doc_name}", subtitle_style))
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#EA580C"), spaceAfter=12))

        # Identified risk clauses
        if risk_analysis:
            story.append(Paragraph("<b>1. Autonomous Clause Risk Analysis</b>", section_h2))
            story.append(Paragraph("The following contractual provisions were evaluated for liability exposure, unilateral covenants, and legal enforceability risks:", body_style))
            story.append(Spacer(1, 6))

            for idx, clause in enumerate(risk_analysis, 1):
                level = clause.get("risk_level", "MEDIUM")
                bg_color = "#FEF2F2" if level == "HIGH" else "#FFFBEB" if level == "MEDIUM" else "#F0FDF4"
                border_color = "#F87171" if level == "HIGH" else "#FCD34D" if level == "MEDIUM" else "#86EFAC"
                tag_color = "#DC2626" if level == "HIGH" else "#D97706" if level == "MEDIUM" else "#16A34A"
                tag_text = "HIGH RISK" if level == "HIGH" else "MEDIUM RISK" if level == "MEDIUM" else "LOW RISK"

                c_name = clause.get("clause_name", "Clause")
                sec_title = clause.get("section_title", "Section")
                page_num = clause.get("page_number", "1")
                excerpt = self.sanitize_text(clause.get("extracted_text", ""))
                analysis = self.sanitize_text(clause.get("analysis", ""))
                remedy = self.sanitize_text(clause.get("remedy_recommendation", ""))

                card_content = [
                    Paragraph(f"<b>{idx}. {c_name}</b> &nbsp;<font color=\"{tag_color}\"><b>[{tag_text}]</b></font> &nbsp;<font color=\"#64748B\">(Location: {sec_title} · Page {page_num})</font>", clause_title_style),
                    Spacer(1, 3),
                ]
                if excerpt:
                    card_content.extend([
                        Paragraph(f"<b>Extracted Excerpt:</b><br/><i>\"{excerpt}\"</i>", excerpt_style),
                        Spacer(1, 3),
                    ])
                card_content.extend([
                    Paragraph(f"<b>Legal Assessment:</b> {analysis}", body_style),
                    Spacer(1, 2),
                    Paragraph(f"<b>Recommended Counter-Language / Remedy:</b> {remedy}", body_style),
                ])

                table_data = [[card_content]]
                table = Table(table_data, colWidths=[540])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(bg_color)),
                    ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor(border_color)),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(KeepTogether([table, Spacer(1, 6)]))

            story.append(Spacer(1, 6))

        # Missing protections
        if missing_clauses:
            story.append(Paragraph("<b>2. Missing Protective Provisions &amp; Omissions</b>", section_h2))
            story.append(Paragraph("The following standard protective clauses were not identified in the contract text:", body_style))
            story.append(Spacer(1, 6))

            for idx, missing in enumerate(missing_clauses, 1):
                sev = missing.get("severity", "MEDIUM")
                m_name = missing.get("clause_name", "Omitted Clause")
                impact = self.sanitize_text(missing.get("impact_description", ""))
                suggested = self.sanitize_text(missing.get("suggested_language", ""))

                card_content = [
                    Paragraph(f"<b>{idx}. Omitted Safeguard: {m_name}</b> &nbsp;<font color=\"#DC2626\"><b>[{sev} SEVERITY]</b></font>", clause_title_style),
                    Spacer(1, 3),
                    Paragraph(f"<b>Legal Impact:</b> {impact}", body_style),
                ]
                if suggested:
                    card_content.extend([
                        Spacer(1, 2),
                        Paragraph(f"<b>Recommended Insertion Language:</b><br/><i>\"{suggested}\"</i>", excerpt_style),
                    ])

                table_data = [[card_content]]
                table = Table(table_data, colWidths=[540])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 8),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ]))
                story.append(KeepTogether([table, Spacer(1, 6)]))

            story.append(Spacer(1, 6))

        # Chat and consultation history
        if messages:
            story.append(Paragraph("<b>3. Interactive Consultation &amp; Auditor Q&amp;A</b>", section_h2))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceAfter=10))

            for idx, msg in enumerate(messages, 1):
                sender = getattr(msg, "sender", None) or (msg.get("sender") if isinstance(msg, dict) else "")
                content = getattr(msg, "content", None) or (msg.get("content") if isinstance(msg, dict) else "")
                if sender == "user":
                    sanitized_q = self.sanitize_text(content)
                    story.append(Paragraph(f"<b>Inquiry #{idx}: {sanitized_q}</b>", user_header))
                    story.append(Spacer(1, 4))
                else:
                    story.append(Paragraph("<b>Auditor Finding:</b>", assistant_header))
                    story.append(Spacer(1, 3))
                    
                    formatted_answer = self.sanitize_text(content)
                    story.append(Paragraph(formatted_answer, body_style))
                    story.append(Spacer(1, 4))

                    if getattr(msg, 'cited_nodes', None) and len(msg.cited_nodes) > 0:
                        cites_text = " &nbsp;|&nbsp; ".join([
                            f"<b>{c.get('title', 'Section')}</b> (p.{c.get('page_index', '1')})"
                            for c in msg.cited_nodes
                        ])
                        story.append(Paragraph(f"<b>Verified Evidence Citations:</b> {cites_text}", citation_badge))
                        story.append(Spacer(1, 4))

                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceBefore=6, spaceAfter=8))

        doc.build(story)
        buffer.seek(0)
        return buffer

_exporter_instance = PDFDossierExporter()

def sanitize_and_format_text(text: str) -> str:
    return PDFDossierExporter.sanitize_text(text)

def generate_session_pdf(
    session_title: str,
    doc_name: str,
    messages: list,
    risk_analysis: list = None,
    missing_clauses: list = None
) -> io.BytesIO:
    return _exporter_instance.generate_dossier(session_title, doc_name, messages, risk_analysis, missing_clauses)