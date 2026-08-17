package de.schwalmtalzupfer.config;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import de.schwalmtalzupfer.member.MemberRole;
import de.schwalmtalzupfer.page.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements ApplicationRunner {

    private final PageRepository pageRepository;
    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String ADMIN_EMAIL = "simon.lankes@gmx.de";
    private static final String ADMIN_PASSWORD = "REDACTED-SEE-HISTORY-CLEANUP";
    private static final String GUEST_EMAIL = "zupfer@schwalmtalzupfer.de";
    private static final String GUEST_PASSWORD = "REDACTED";
    private static final String ZUPF_PASSWORD = "REDACTED";

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        // ---- Admin-User ----
        if (!memberRepository.existsByEmail(ADMIN_EMAIL)) {
            memberRepository.save(Member.builder()
                    .email(ADMIN_EMAIL)
                    .passwordHash(passwordEncoder.encode(ADMIN_PASSWORD))
                    .vorname("Simon")
                    .nachname("Lankes")
                    .role(MemberRole.ADMIN)
                    .build());
            log.info("DataInitializer: Admin-User '{}' angelegt (Passwort: {}).", ADMIN_EMAIL, ADMIN_PASSWORD);
        }

        // ---- Gast-Demo-User (zupfer/zupfer) ----
        if (!memberRepository.existsByEmail(GUEST_EMAIL)) {
            memberRepository.save(Member.builder()
                    .email(GUEST_EMAIL)
                    .passwordHash(passwordEncoder.encode(GUEST_PASSWORD))
                    .vorname("Gast")
                    .nachname("Zupfer")
                    .role(MemberRole.GUEST)
                    .build());
            log.info("DataInitializer: Gast-User '{}' angelegt.", GUEST_EMAIL);
        }

        // ---- Zupf-User (zupf/zupf) - Nur Intern-Zugang, kein Profil ----
        // Dieser User nutzt Username statt Email für Login
        if (!memberRepository.existsByUsername("zupf")) {
            memberRepository.save(Member.builder()
                    .username("zupf")
                    .email(null)
                    .passwordHash(passwordEncoder.encode(ZUPF_PASSWORD))
                    .vorname("Zupf")
                    .role(MemberRole.GUEST)
                    .build());
            log.info("DataInitializer: Zupf-User 'zupf' angelegt.");
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

