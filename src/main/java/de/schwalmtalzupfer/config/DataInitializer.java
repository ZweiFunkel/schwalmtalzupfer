package de.schwalmtalzupfer.config;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import de.schwalmtalzupfer.member.MemberRole;
import de.schwalmtalzupfer.page.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Stellt sicher, dass beim Start mindestens die Basis-Seitenstruktur vorhanden ist.
 * Verhindert 404-Fehler auf Home, Konzerte, Vorstand, Geschichte.
 *
 * Legt EINMALIG (nur falls noch kein Admin existiert) einen Bootstrap-Admin an - aus
 * app.bootstrap.admin-email/-password (Umgebungsvariablen), NIE aus einem hartkodierten
 * Wert im Quellcode. Ist eine der beiden Variablen nicht gesetzt, wird das Anlegen
 * übersprungen (fail-closed) statt auf ein unsicheres Standard-Passwort zurückzufallen -
 * anders als z.B. beim Deploy-Token ist ein zu schwaches/fehlendes Admin-Passwort ein
 * ernstes Risiko, kein bloßer Komfortverlust.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final PageRepository pageRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.bootstrap.admin-email:}")
    private String bootstrapAdminEmail;

    @Value("${app.bootstrap.admin-password:}")
    private String bootstrapAdminPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!memberRepository.existsByRole(MemberRole.ADMIN)) {
            if (bootstrapAdminEmail.isBlank() || bootstrapAdminPassword.isBlank()) {
                log.warn("DataInitializer: Kein Admin-Account vorhanden und app.bootstrap.admin-email/-password " +
                        "nicht gesetzt - es wird KEIN Bootstrap-Admin angelegt. Bitte in application.yml/Env setzen.");
            } else {
                memberRepository.save(Member.builder()
                        .email(bootstrapAdminEmail)
                        .passwordHash(passwordEncoder.encode(bootstrapAdminPassword))
                        .vorname("Admin")
                        .role(MemberRole.ADMIN)
                        .build());
                log.info("DataInitializer: Bootstrap-Admin-User '{}' angelegt.", bootstrapAdminEmail);
            }
        }

        ensurePage("home", "Startseite", List.of(
                PageSection.builder()
                        .type(SectionType.HERO)
                        .position(1)
                        .content(Map.of(
                                "headline", "Herzlich Willkommen",
                                "subheadline", "Musik verbindet – Gemeinschaft bewegt.",
                                "ctaLabel", "Konzerte entdecken",
                                "ctaHref", "/konzerte",
                                "imageUrl", "/assets/hero-bg.jpg"
                        ))
                        .build(),
                PageSection.builder()
                        .type(SectionType.EVENT_CARD)
                        .position(2)
                        .content(Map.of(
                                "events", List.of(
                                        Map.of("title", "Sommerkonzert 2026", "date", "28.06.2026",
                                                "location", "Waldnieler Marktplatz",
                                                "description", "Unser jährliches Sommerkonzert."),
                                        Map.of("title", "Weihnachtskonzert 2026", "date", "20.12.2026",
                                                "location", "St. Antonius Kirche",
                                                "description", "Adventsklänge im festlichen Ambiente.")
                                )
                        ))
                        .build()
        ));

        ensurePage("konzerte", "Konzerte", List.of(
                PageSection.builder()
                        .type(SectionType.EVENT_CARD)
                        .position(1)
                        .content(Map.of(
                                "events", List.of(
                                        Map.of("title", "Sommerkonzert 2026", "date", "28.06.2026",
                                                "location", "Waldnieler Marktplatz",
                                                "description", "Open Air – kostenloser Eintritt."),
                                        Map.of("title", "Herbstkonzert 2026", "date", "15.10.2026",
                                                "location", "Kulturzentrum Schwalmtal",
                                                "description", "Herbstliche Klänge für jung und alt."),
                                        Map.of("title", "Weihnachtskonzert 2026", "date", "20.12.2026",
                                                "location", "St. Antonius Kirche",
                                                "description", "Adventsklänge im festlichen Ambiente.")
                                )
                        ))
                        .build()
        ));

        ensurePage("geschichte", "Geschichte", List.of(
                PageSection.builder()
                        .type(SectionType.TEXT_BLOCK)
                        .position(1)
                        .content(Map.of(
                                "heading", "Unsere Geschichte",
                                "markdown", "## Vom kleinen Ensemble zum Verein\n\nDie **Schwalmtaler Zupfer** wurden in den 1980er Jahren gegründet..."
                        ))
                        .build()
        ));

        ensurePage("vorstand", "Vorstand", List.of(
                PageSection.builder()
                        .type(SectionType.PERSON_GRID)
                        .position(1)
                        .content(Map.of(
                                "heading", "Unser Vorstand",
                                "persons", List.of(
                                        Map.of("name", "Benjamin Münten", "role", "1. Vorsitzender",
                                                "imageUrl", "/assets/placeholder-person.png",
                                                "email", "benjamin.muenten@schwalmtalzupfer.de"),
                                        Map.of("name", "Frank Trepte", "role", "2. Vorsitzender",
                                                "imageUrl", "/assets/placeholder-person.png",
                                                "email", "frank.trepte@schwalmtalzupfer.de")
                                )
                        ))
                        .build()
        ));

        log.info("DataInitializer: Seiten-Struktur sichergestellt.");
    }

    private void ensurePage(String slug, String title, List<PageSection> defaultSections) {
        if (pageRepository.findBySlug(slug).isPresent()) {
            return; // bereits vorhanden
        }
        de.schwalmtalzupfer.page.Page page = de.schwalmtalzupfer.page.Page.builder()
                .slug(slug)
                .title(title)
                .build();
        for (PageSection s : defaultSections) {
            s.setPage(page);
            page.getSections().add(s);
        }
        pageRepository.save(page);
        log.info("DataInitializer: Seite '{}' angelegt.", slug);
    }
}

