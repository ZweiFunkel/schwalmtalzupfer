package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.pricing.PriceGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Ermittelt die zu einem Zeitpunkt wirksame Gitarrengruppen-Zuordnung + den Preis eines
 * Mitglieds aus {@link MitgliedGruppenHistorie}: der wirksame Eintrag ist immer der mit dem
 * größten {@code gueltigAb <= heute}. So sieht ein Mitglied bis zum Stichtag noch die alte
 * Gruppe/Zeit/Ort/Preis und automatisch ab dem Stichtag die neue - ohne Cronjob, da bei jedem
 * Lesezugriff neu berechnet wird.
 *
 * Hat ein Mitglied noch KEINEN Historie-Eintrag (z.B. weil die Zuordnung noch nie über diesen
 * neuen Weg gepflegt wurde), wird auf die alte direkte {@link Member#getGitarrengruppe()}
 * zurückgefallen - mit unbekanntem individuellem Preis (fällt dann ggf. auf den Preisgruppen-
 * Satz der Gruppe zurück) und unbekanntem Gültig-ab-Datum. Diese Mitglieder sollten nach und
 * nach über {@link #addEntry} einen echten Historie-Eintrag erhalten (deckt auch das Erfassen
 * bestehender Alt-Verträge ab).
 *
 * Preis-Auflösung: ein individueller Preis auf dem Historie-Eintrag (z.B. ein historisch
 * abweichend vereinbarter Betrag) hat Vorrang; ohne individuellen Preis gilt der ganz normale,
 * ebenfalls zeitlich versionierte Satz der {@link de.schwalmtalzupfer.pricing.PriceGroup} der
 * Gruppe (siehe {@link PriceGroupService#effectiveRate}) - Preiserhöhungen der Preisgruppe
 * wirken sich also automatisch aus, ohne dass jeder Mitglied-Eintrag angefasst werden muss.
 */
@Service
@RequiredArgsConstructor
public class GruppenHistorieService {

    private final MitgliedGruppenHistorieRepository historieRepository;
    private final MemberRepository memberRepository;
    private final PriceGroupService priceGroupService;

    public record EffectiveAssignment(
            Gitarrengruppe gruppe,
            Integer monatsbeitragCents,
            boolean individuellerPreis,
            LocalDate gueltigAb,
            boolean ausHistorie
    ) {}

    public EffectiveAssignment current(Member member) {
        LocalDate heute = LocalDate.now();
        Optional<MitgliedGruppenHistorie> wirksam = historieRepository.findByMemberIdOrderByGueltigAbDesc(member.getId()).stream()
                .filter(h -> !h.getGueltigAb().isAfter(heute))
                .findFirst();

        Gitarrengruppe gruppe = wirksam.map(MitgliedGruppenHistorie::getGitarrengruppe).orElseGet(member::getGitarrengruppe);
        Integer individuellerPreis = wirksam.map(MitgliedGruppenHistorie::getMonatsbeitragCents).orElse(null);

        Integer preis = individuellerPreis;
        boolean istIndividuell = individuellerPreis != null;
        if (preis == null && gruppe != null && gruppe.getPriceGroup() != null) {
            preis = priceGroupService.effectiveRate(gruppe.getPriceGroup().getId())
                    .map(rate -> rate.getAmountCents())
                    .orElse(null);
        }

        return new EffectiveAssignment(gruppe, preis, istIndividuell, wirksam.map(MitgliedGruppenHistorie::getGueltigAb).orElse(null), wirksam.isPresent());
    }

    /** Frühester bereits geplanter, aber noch nicht wirksamer Wechsel (falls vorhanden). */
    public Optional<MitgliedGruppenHistorie> next(Member member) {
        LocalDate heute = LocalDate.now();
        return historieRepository.findByMemberIdOrderByGueltigAbDesc(member.getId()).stream()
                .filter(h -> h.getGueltigAb().isAfter(heute))
                .min(Comparator.comparing(MitgliedGruppenHistorie::getGueltigAb));
    }

    public List<MitgliedGruppenHistorie> history(Member member) {
        return historieRepository.findByMemberIdOrderByGueltigAbDesc(member.getId());
    }

    @Transactional
    public MitgliedGruppenHistorie addEntry(
            Member member, Gitarrengruppe gruppe, Integer monatsbeitragCents,
            LocalDate gueltigAb, String notiz, Member erstelltVon
    ) {
        MitgliedGruppenHistorie entry = MitgliedGruppenHistorie.builder()
                .member(member)
                .gitarrengruppe(gruppe)
                .monatsbeitragCents(monatsbeitragCents)
                .gueltigAb(gueltigAb)
                .notiz(notiz)
                .erstelltVon(erstelltVon)
                .build();
        MitgliedGruppenHistorie saved = historieRepository.save(entry);

        // Legacy-Feld synchron halten, solange andere Stellen es evtl. noch direkt lesen -
        // nur bei bereits (heute oder rückwirkend) wirksamen Änderungen. Zukünftige Änderungen
        // berücksichtigt current() automatisch, sobald das Datum erreicht ist.
        if (!gueltigAb.isAfter(LocalDate.now())) {
            member.setGitarrengruppe(gruppe);
            memberRepository.save(member);
        }
        return saved;
    }
}
