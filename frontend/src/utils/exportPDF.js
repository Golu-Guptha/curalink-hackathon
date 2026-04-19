import { jsPDF } from 'jspdf';

/** Strip emoji and non-Latin characters that Helvetica can't render */
function strip(text = '') {
    return (text || '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // emoji blocks
        .replace(/[\u2600-\u27BF]/g, '')            // misc symbols
        .replace(/[^\x00-\xFF]/g, '')               // anything outside Latin-1
        .replace(/\*\*/g, '')                       // markdown bold
        .replace(/\s{2,}/g, ' ')                   // collapse double spaces
        .trim();
}

/** Section labels — plain text equivalents for emojis */
const LABEL = {
    keyInsight:      'KEY INSIGHT',
    overview:        'CONDITION OVERVIEW',
    insights:        'KEY RESEARCH INSIGHTS',
    recommendation:  'RECOMMENDATION',
    contradictions:  'CONFLICTING EVIDENCE & LIMITATIONS',
    trials:          'CLINICAL TRIALS',
    publications:    'TOP PUBLICATIONS',
    breakdown:       'EVIDENCE CONFIDENCE BREAKDOWN',
};

/**
 * Exports the CuraLink research result as a structured, readable PDF report.
 */
export function exportResultToPDF(result) {
    if (!result) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN     = 50;
    const CONTENT_W  = PAGE_W - MARGIN * 2;

    let y = MARGIN;

    const meta    = result.metadata || {};
    const disease = strip(meta.expanded_disease || meta.disease || 'Medical Research');
    const location = strip(meta.location || '');
    const date    = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── Palette (dark text on white paper) ───────────────────────────────────
    const C = {
        primary:    [55, 75, 230],    // indigo
        heading:    [25, 30, 80],     // near-black indigo
        subheading: [60, 70, 140],    // medium indigo
        body:       [40, 45, 65],     // dark slate
        muted:      [110, 120, 150],  // slate grey
        green:      [22, 140, 65],
        amber:      [170, 110, 10],
        teal:       [15, 140, 160],
        purple:     [110, 60, 200],
        white:      [255, 255, 255],
        lightBg:    [245, 247, 255],  // very light indigo tint
        border:     [210, 215, 235],
        accentBg:   [235, 238, 255],  // accent fill for key insight
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const checkPage = (needed = 20) => {
        if (y + needed > PAGE_H - MARGIN) {
            // Footer before new page
            addFooter();
            doc.addPage();
            y = MARGIN;
        }
    };

    const setColor = (rgb) => doc.setTextColor(...rgb);

    const sectionHeading = (text, color = C.primary) => {
        checkPage(32);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        setColor(color);
        doc.text(text.toUpperCase(), MARGIN, y);
        y += 4;
        // Underline
        doc.setDrawColor(...color);
        doc.setLineWidth(1.2);
        doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
        y += 14;
    };

    const body = (text, opts = {}) => {
        const { indent = 0, color = C.body, size = 9.5, bold = false } = opts;
        const clean = strip(text);
        if (!clean) return;
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        setColor(color);
        const lines = doc.splitTextToSize(clean, CONTENT_W - indent);
        lines.forEach(line => {
            checkPage(13);
            doc.text(line, MARGIN + indent, y);
            y += 13;
        });
        y += 2;
    };

    const gap = (px = 10) => { y += px; };

    const pill = (text, x, yPos, bg, fg = C.white) => {
        const clean = strip(text);
        if (!clean) return 0;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        const w = doc.getTextWidth(clean) + 14;
        doc.setFillColor(...bg);
        doc.roundedRect(x, yPos - 9, w, 13, 3, 3, 'F');
        setColor(fg);
        doc.text(clean, x + 7, yPos);
        return w + 5;
    };

    const addFooter = () => {
        const pg = doc.internal.getCurrentPageInfo().pageNumber;
        const total = doc.internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        setColor(C.muted);
        doc.text(
            `CuraLink AI Medical Research  |  For research purposes only. Not medical advice.  |  Page ${pg} of ${total}`,
            MARGIN, PAGE_H - 22
        );
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, PAGE_H - 32, PAGE_W - MARGIN, PAGE_H - 32);
    };

    // ── COVER HEADER ─────────────────────────────────────────────────────────
    doc.setFillColor(...C.heading);
    doc.rect(0, 0, PAGE_W, 115, 'F');

    // Logo
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    setColor(C.primary);
    // Use solid indigo bg: override text as white-ish on dark
    setColor([130, 150, 255]);
    doc.text('CuraLink', MARGIN, 44);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor([160, 170, 210]);
    doc.text('AI Medical Research Assistant', MARGIN, 58);

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    setColor([230, 235, 255]);
    doc.text(`Research Report: ${disease}`, MARGIN, 80);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    setColor([120, 130, 175]);
    doc.text(
        `Generated: ${date}${location ? `  |  Location: ${location}` : ''}`,
        MARGIN, 97
    );

    y = 130;

    // ── STATS CARDS ROW ───────────────────────────────────────────────────────
    const stats = [
        { label: 'Publications Analyzed', value: meta.total_candidates || result.publications?.length || 0 },
        { label: 'Selected',              value: result.publications?.length || 0 },
        { label: 'Clinical Trials',       value: result.clinical_trials?.length || 0 },
        { label: 'Insights',              value: result.research_insights?.length || 0 },
    ];
    const colW = CONTENT_W / stats.length;
    stats.forEach((s, i) => {
        const cx = MARGIN + i * colW;
        doc.setFillColor(...C.lightBg);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.5);
        doc.roundedRect(cx, y, colW - 8, 46, 5, 5, 'FD');

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        setColor(C.primary);
        doc.text(String(s.value), cx + 10, y + 28);

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        setColor(C.muted);
        doc.text(s.label, cx + 10, y + 38);
    });
    y += 60;

    // Confidence + agreement line
    const bk = result.confidence_breakdown || meta.confidence_breakdown || {};
    const confPct = bk.final ? Math.round(bk.final * 100) : 0;
    const agreeScore = result.agreement_score || 0;
    if (confPct > 0) {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        setColor(C.muted);
        doc.text(
            `Evidence Confidence: ${confPct}%   |   Study Agreement: ${Math.round(agreeScore * 100)}%   |   Ranking: ${strip(meta.ranking_method || 'Hybrid')}`,
            MARGIN, y
        );
        y += 18;
    }
    gap(8);

    // ── KEY INSIGHT ───────────────────────────────────────────────────────────
    if (result.key_insight) {
        sectionHeading(LABEL.keyInsight, C.primary);
        // Highlighted box
        doc.setFillColor(...C.accentBg);
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.5);
        const insightLines = doc.splitTextToSize(strip(result.key_insight), CONTENT_W - 24);
        const boxH = insightLines.length * 13 + 16;
        checkPage(boxH + 8);
        doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 5, 5, 'FD');
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        setColor(C.subheading);
        insightLines.forEach(line => { doc.text(line, MARGIN + 12, y + 12); y += 13; });
        y += 14;
        gap(12);
    }

    // ── CONDITION OVERVIEW ────────────────────────────────────────────────────
    if (result.condition_overview) {
        sectionHeading(LABEL.overview, C.subheading);
        body(result.condition_overview);
        gap(10);
    }

    // ── RESEARCH INSIGHTS ─────────────────────────────────────────────────────
    const insights = result.research_insights || [];
    if (insights.length > 0) {
        sectionHeading(LABEL.insights, C.purple);
        insights.forEach((ins, i) => {
            checkPage(70);
            // Finding
            body(`${i + 1}. ${ins.finding}`, { bold: true, color: C.heading, size: 10 });

            // Badge pills row
            let bx = MARGIN + 12;
            const pillY = y + 1;
            if (ins.study_type) {
                bx += pill(strip(ins.study_type), bx, pillY, C.green);
            }
            if (ins.confidence_level) {
                const cc = ins.confidence_level === 'High' ? C.green : ins.confidence_level === 'Moderate' ? C.primary : C.amber;
                bx += pill(`${strip(ins.confidence_level)} Confidence`, bx, pillY, cc);
            }
            if (ins.study_type || ins.confidence_level) y += 18;

            if (ins.effect_size) body(`Effect: ${strip(ins.effect_size)}`, { indent: 12, color: C.teal, size: 9 });
            if (ins.population)  body(`Population: ${strip(ins.population)}`, { indent: 12, color: C.purple, size: 9 });
            if (ins.evidence)    body(`"${strip(ins.evidence)}"`, { indent: 12, color: C.muted, size: 8.5 });

            if (ins.source_ids?.length) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                setColor(C.primary);
                doc.text(`Sources: ${ins.source_ids.join(', ')}`, MARGIN + 12, y);
                y += 14;
            }
            gap(6);
        });
        gap(6);
    }

    // ── RECOMMENDATION ────────────────────────────────────────────────────────
    if (result.recommendation) {
        sectionHeading(LABEL.recommendation, C.green);
        body(result.recommendation);
        gap(10);
    }

    // ── CONTRADICTIONS ────────────────────────────────────────────────────────
    const contradictions = result.contradictions || [];
    if (contradictions.length > 0) {
        sectionHeading(LABEL.contradictions, C.amber);
        contradictions.forEach(c => body(`- ${strip(c)}`, { indent: 8, color: C.amber }));
        gap(10);
    }

    // ── CLINICAL TRIALS ───────────────────────────────────────────────────────
    const trials = result.clinical_trials || [];
    if (trials.length > 0) {
        sectionHeading(LABEL.trials, C.teal);
        if (result.location_context) {
            body(`Location: ${strip(result.location_context)}`, { color: C.teal, size: 9 });
        }
        trials.slice(0, 6).forEach(t => {
            checkPage(55);
            body(strip(t.title), { bold: true, color: C.heading, size: 9.5 });
            const locs = t.locations?.slice(0, 3).map(l => [l.city, l.country].filter(Boolean).join(', ')).join(' | ') || 'Global';
            body(`Status: ${t.status}  |  Phase: ${t.phase || 'N/A'}  |  Locations: ${strip(locs)}`, { indent: 10, color: C.muted, size: 8.5 });
            if (t.eligibility_summary) {
                body(strip(t.eligibility_summary).slice(0, 220) + '...', { indent: 10, color: C.body, size: 8.5 });
            }
            body(`URL: ${t.url}`, { indent: 10, color: C.primary, size: 8 });
            gap(6);
        });
    }

    // ── PUBLICATIONS ──────────────────────────────────────────────────────────
    const pubs = result.publications || [];
    if (pubs.length > 0) {
        sectionHeading(LABEL.publications, C.subheading);
        pubs.slice(0, 8).forEach((p, i) => {
            checkPage(55);
            body(`${i + 1}. ${strip(p.title)}`, { bold: true, color: C.heading, size: 9.5 });
            const authors = (p.authors?.slice(0, 3).join(', ') || '') + (p.authors?.length > 3 ? ' et al.' : '');
            body(`${strip(authors)} (${p.year || 'N/A'})  |  ${p.source}  |  Citations: ${p.cited_by_count}`, { indent: 10, color: C.muted, size: 8.5 });
            if (p.supporting_snippet) {
                body(strip(p.supporting_snippet).slice(0, 240) + '...', { indent: 10, color: C.body, size: 8.5 });
            }
            body(`URL: ${p.url}`, { indent: 10, color: C.primary, size: 8 });
            gap(6);
        });
    }

    // ── CONFIDENCE BREAKDOWN ──────────────────────────────────────────────────
    if (bk.formula) {
        sectionHeading(LABEL.breakdown, C.primary);
        body(`Formula: ${strip(bk.formula)}`, { color: C.subheading });
        body(`- Relevance:  ${Math.round((bk.avg_relevance || 0) * 100)}%  (weight: ${bk.relevance_weight || 0.40})`, { indent: 10 });
        body(`- Recency:    ${Math.round((bk.recency_score || 0) * 100)}%  (weight: ${bk.recency_weight || 0.30})`, { indent: 10 });
        body(`- Citations:  ${Math.round((bk.citation_score || 0) * 100)}%  (weight: ${bk.citation_weight || 0.20})`, { indent: 10 });
        body(`- Trial bonus: +${Math.round((bk.trial_bonus || 0) * 100)}%`, { indent: 10 });
        body(`Final Confidence: ${confPct}%`, { bold: true, color: C.primary });
        gap(10);
    }

    // ── ADD FOOTER TO ALL PAGES ───────────────────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let pg = 1; pg <= totalPages; pg++) {
        doc.setPage(pg);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        setColor(C.muted);
        doc.text(
            `CuraLink AI Medical Research  |  For research purposes only. Not medical advice.  |  Page ${pg} of ${totalPages}`,
            MARGIN, PAGE_H - 22
        );
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, PAGE_H - 32, PAGE_W - MARGIN, PAGE_H - 32);
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const filename = `CuraLink_${disease.replace(/\s+/g, '_')}_${date.replace(/,?\s+/g, '_')}.pdf`;
    doc.save(filename);
}
