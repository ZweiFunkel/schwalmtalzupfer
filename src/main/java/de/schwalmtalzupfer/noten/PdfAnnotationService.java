package de.schwalmtalzupfer.noten;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.blend.BlendMode;
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;

/**
 * Brennt Markierungen (Stift, Textmarker, Text) als Vektorgrafik in eine PDF ein.
 *
 * <p>Der Client liefert Koordinaten relativ zur <em>angezeigten</em> Seite (0..1 von links oben, nach
 * Anwendung von /Rotate und auf Basis der CropBox - so wie pdf.js die Seite rendert). Hier werden sie in
 * den PDF-Benutzerraum der Seite zurückgerechnet.
 */
@Service
public class PdfAnnotationService {

    public static final int MAX_MARKS = 20_000;
    public static final int MAX_POINTS = 400_000;

    public record Mark(String type, int page, String color, double width, double opacity,
                       List<List<Double>> points, double x, double y, String text, double size) {}

    public byte[] apply(byte[] pdf, List<Mark> marks) throws IOException {
        if (marks.size() > MAX_MARKS) throw new IllegalArgumentException("Zu viele Markierungen");
        int totalPoints = marks.stream().mapToInt(m -> m.points() == null ? 0 : m.points().size()).sum();
        if (totalPoints > MAX_POINTS) throw new IllegalArgumentException("Zu viele Punkte");

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            if (doc.isEncrypted()) throw new IllegalArgumentException("Verschlüsselte PDFs können nicht bearbeitet werden");
            int pageCount = doc.getNumberOfPages();

            for (int pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                final int idx = pageIndex;
                List<Mark> onPage = marks.stream().filter(m -> m.page() == idx).toList();
                if (onPage.isEmpty()) continue;

                PDPage page = doc.getPage(pageIndex);
                Geometry g = new Geometry(page);
                try (PDPageContentStream cs = new PDPageContentStream(doc, page,
                        PDPageContentStream.AppendMode.APPEND, true, true)) {
                    for (Mark m : onPage) {
                        if ("text".equals(m.type())) drawText(cs, g, m);
                        else drawStroke(doc, cs, g, m);
                    }
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream(pdf.length + 64 * 1024);
            doc.save(out);
            return out.toByteArray();
        }
    }

    private void drawStroke(PDDocument doc, PDPageContentStream cs, Geometry g, Mark m) throws IOException {
        if (m.points() == null || m.points().isEmpty()) return;
        boolean highlighter = "highlighter".equals(m.type());

        cs.saveGraphicsState();
        PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
        double alpha = clamp(m.opacity() > 0 ? m.opacity() : (highlighter ? 0.35 : 1.0), 0.05, 1.0);
        gs.setStrokingAlphaConstant((float) alpha);
        gs.setNonStrokingAlphaConstant((float) alpha);
        if (highlighter) gs.setBlendMode(BlendMode.MULTIPLY);
        cs.setGraphicsStateParameters(gs);

        cs.setStrokingColor(parseColor(m.color()));
        cs.setLineWidth((float) Math.max(0.2, clamp(m.width(), 0.0005, 0.2) * g.displayWidth));
        cs.setLineCapStyle(1);
        cs.setLineJoinStyle(1);

        List<Double> first = m.points().get(0);
        float[] p0 = g.toPdf(first.get(0), first.get(1));
        cs.moveTo(p0[0], p0[1]);
        if (m.points().size() == 1) {
            cs.lineTo(p0[0], p0[1]); // Punkt: mit runder Kappe als Dot
        }
        for (int i = 1; i < m.points().size(); i++) {
            List<Double> p = m.points().get(i);
            float[] q = g.toPdf(p.get(0), p.get(1));
            cs.lineTo(q[0], q[1]);
        }
        cs.stroke();
        cs.restoreGraphicsState();
    }

    private void drawText(PDPageContentStream cs, Geometry g, Mark m) throws IOException {
        if (m.text() == null || m.text().isBlank()) return;
        float fontSize = (float) Math.max(4, clamp(m.size(), 0.005, 0.2) * g.displayWidth);
        PDType1Font font = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
        float[] origin = g.toPdf(m.x(), m.y());
        // Text so drehen, dass er in der angezeigten Seite waagerecht liegt
        Matrix base = Matrix.getRotateInstance(Math.toRadians(-g.rotation), origin[0], origin[1]);

        cs.saveGraphicsState();
        cs.setNonStrokingColor(parseColor(m.color()));
        cs.beginText();
        cs.setFont(font, fontSize);
        String[] lines = m.text().split("\r?\n");
        for (int i = 0; i < lines.length; i++) {
            // Zeilenversatz nach unten in angezeigter Richtung
            Matrix lineMatrix = base.clone();
            lineMatrix.translate(0, -fontSize * 1.2f * i);
            cs.setTextMatrix(lineMatrix);
            cs.showText(sanitize(lines[i], font));
        }
        cs.endText();
        cs.restoreGraphicsState();
    }

    /** Standard-Schrift kann nur WinAnsi: alles andere durch '?' ersetzen statt abzubrechen. */
    private String sanitize(String s, PDType1Font font) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            try {
                font.encode(String.valueOf(c));
                sb.append(c);
            } catch (Exception e) {
                sb.append('?');
            }
        }
        return sb.toString();
    }

    private static Color parseColor(String hex) {
        try {
            String h = hex == null ? "#000000" : hex.trim();
            if (h.startsWith("#")) h = h.substring(1);
            if (h.length() == 3) h = "" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
            return new Color(Integer.parseInt(h.substring(0, 6), 16));
        } catch (Exception e) {
            return Color.BLACK;
        }
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    /** Rechnet Anzeige-Koordinaten (0..1 von links oben der gedrehten Seite) in PDF-Benutzerraum um. */
    private static final class Geometry {
        final float llx, lly, urx, ury, w, h;
        final int rotation;
        final double displayWidth;

        Geometry(PDPage page) {
            PDRectangle box = page.getCropBox();
            llx = box.getLowerLeftX();
            lly = box.getLowerLeftY();
            urx = box.getUpperRightX();
            ury = box.getUpperRightY();
            w = box.getWidth();
            h = box.getHeight();
            rotation = ((page.getRotation() % 360) + 360) % 360;
            displayWidth = (rotation == 90 || rotation == 270) ? h : w;
        }

        float[] toPdf(double nx, double ny) {
            nx = clamp(nx, 0, 1);
            ny = clamp(ny, 0, 1);
            return switch (rotation) {
                case 90 -> new float[]{(float) (llx + ny * w), (float) (lly + nx * h)};
                case 180 -> new float[]{(float) (urx - nx * w), (float) (lly + ny * h)};
                case 270 -> new float[]{(float) (urx - ny * w), (float) (ury - nx * h)};
                default -> new float[]{(float) (llx + nx * w), (float) (lly + (1 - ny) * h)};
            };
        }
    }
}
