package de.schwalmtalzupfer.noten;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PdfAnnotationServiceTest {

    private final PdfAnnotationService service = new PdfAnnotationService();

    private byte[] blankPdf(int rotation, PDRectangle box) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(box);
            page.setRotation(rotation);
            doc.addPage(page);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private BufferedImage render(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFRenderer(doc).renderImage(0, 1.0f);
        }
    }

    private static boolean isRedAt(BufferedImage img, double nx, double ny) {
        int x = (int) Math.round(nx * (img.getWidth() - 1));
        int y = (int) Math.round(ny * (img.getHeight() - 1));
        Color c = new Color(img.getRGB(x, y));
        return c.getRed() > 200 && c.getGreen() < 60 && c.getBlue() < 60;
    }

    @Test
    void strokeLandsAtTheDisplayedPositionForEveryPageRotation() throws Exception {
        // Punkt bei 25 % von links / 25 % von oben der ANGEZEIGTEN Seite, dick genug zum Treffen
        PdfAnnotationService.Mark dot = new PdfAnnotationService.Mark(
                "pen", 0, "#ff0000", 0.08, 1.0, List.of(List.of(0.25, 0.25)), 0, 0, null, 0);

        for (int rotation : new int[]{0, 90, 180, 270}) {
            byte[] edited = service.apply(blankPdf(rotation, new PDRectangle(300, 200)), List.of(dot));
            BufferedImage img = render(edited);

            assertThat(isRedAt(img, 0.25, 0.25)).as("Rotation %d: Markierung an der Zielstelle", rotation).isTrue();
            assertThat(isRedAt(img, 0.75, 0.75)).as("Rotation %d: gegenüberliegende Ecke bleibt leer", rotation).isFalse();
            assertThat(isRedAt(img, 0.75, 0.25)).as("Rotation %d: nicht gespiegelt (x)", rotation).isFalse();
            assertThat(isRedAt(img, 0.25, 0.75)).as("Rotation %d: nicht gespiegelt (y)", rotation).isFalse();
        }
    }

    @Test
    void cropBoxOffsetIsRespected() throws Exception {
        byte[] pdf;
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(new PDRectangle(400, 400));
            page.setCropBox(new PDRectangle(100, 100, 200, 100)); // nur ein Ausschnitt ist sichtbar
            doc.addPage(page);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            pdf = out.toByteArray();
        }
        PdfAnnotationService.Mark dot = new PdfAnnotationService.Mark(
                "pen", 0, "#ff0000", 0.1, 1.0, List.of(List.of(0.5, 0.5)), 0, 0, null, 0);

        BufferedImage img = render(service.apply(pdf, List.of(dot)));

        assertThat(img.getWidth()).isEqualTo(200);
        assertThat(isRedAt(img, 0.5, 0.5)).isTrue();
    }

    @Test
    void textAndHighlighterDoNotBreakThePdf() throws Exception {
        List<PdfAnnotationService.Mark> marks = List.of(
                new PdfAnnotationService.Mark("text", 0, "#0000ff", 0, 1.0, null, 0.1, 0.2, "Größe ändern – ok\nzweite Zeile", 0.04),
                new PdfAnnotationService.Mark("highlighter", 0, "#ffff00", 0.03, 0.35,
                        List.of(List.of(0.1, 0.5), List.of(0.8, 0.5)), 0, 0, null, 0));

        byte[] edited = service.apply(blankPdf(0, PDRectangle.A4), marks);

        try (PDDocument doc = Loader.loadPDF(edited)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(1);
        }
    }

    @Test
    void marksOnOtherPagesAndEmptyPointListsAreIgnored() throws Exception {
        PdfAnnotationService.Mark ghost = new PdfAnnotationService.Mark(
                "pen", 5, "#ff0000", 0.05, 1.0, List.of(List.of(0.5, 0.5)), 0, 0, null, 0);
        PdfAnnotationService.Mark empty = new PdfAnnotationService.Mark(
                "pen", 0, "#ff0000", 0.05, 1.0, List.of(), 0, 0, null, 0);

        byte[] edited = service.apply(blankPdf(0, PDRectangle.A4), List.of(ghost, empty));

        assertThat(isRedAt(render(edited), 0.5, 0.5)).isFalse();
    }

    @Test
    void editableKeyRulesProtectBackupsAndNonPdfs() {
        assertThat(NotenEditController.isEditablePdfKey("Noten/Lied.pdf")).isTrue();
        assertThat(NotenEditController.isEditablePdfKey("Noten/Lied.PDF")).isTrue();
        assertThat(NotenEditController.isEditablePdfKey("Noten/Lied.mp3")).isFalse();
        assertThat(NotenEditController.isEditablePdfKey("_versions/Noten/Lied.pdf/20260101-000000-000.pdf")).isFalse();
        assertThat(NotenEditController.isEditablePdfKey("../geheim.pdf")).isFalse();
        assertThat(NotenEditController.isEditablePdfKey(null)).isFalse();
    }
}
