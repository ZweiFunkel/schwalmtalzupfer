package de.schwalmtalzupfer.payment;

import com.stripe.exception.StripeException;
import com.stripe.model.Subscription;
import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import de.schwalmtalzupfer.pricing.PriceGroupRate;
import de.schwalmtalzupfer.pricing.PriceGroupRateRepository;
import de.schwalmtalzupfer.pricing.PriceGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Schließt die Registrierung eines aus einem Beitrittsantrag eingeladenen Mitglieds ab:
 * Preis in Stripe sicherstellen, Zahlungsart hinterlegen, Abo anlegen, Vertrag speichern.
 * Das ist der Moment, in dem der Mitgliedsvertrag rechtlich zustande kommt.
 */
@Service
@RequiredArgsConstructor
public class RegistrationService {

    private final StripeService stripeService;
    private final MemberRepository memberRepository;
    private final PriceGroupRateRepository priceGroupRateRepository;
    private final PriceGroupService priceGroupService;
    private final MembershipContractRepository membershipContractRepository;

    @Transactional
    public void completeContract(Member member, PriceGroupRate rate, String stripeCustomerId, String stripePaymentMethodId) {
        // Kunden-ID sofort sichern, BEVOR Stripe-Aufrufe fehlschlagen können (z.B. Karte abgelehnt) -
        // sonst hätte das Mitglied keinen Weg mehr, die Zahlungseinrichtung nachzuholen.
        member.setStripeCustomerId(stripeCustomerId);
        memberRepository.save(member);

        try {
            String priceId = stripeService.ensureStripePrice(rate);
            if (!priceId.equals(rate.getStripePriceId())) {
                rate.setStripePriceId(priceId);
                priceGroupRateRepository.save(rate);
            }

            stripeService.attachPaymentMethodAsDefault(stripeCustomerId, stripePaymentMethodId);
            Subscription subscription = stripeService.createSubscription(stripeCustomerId, priceId);

            saveContract(member, rate, stripeCustomerId, subscription.getId());
        } catch (StripeException e) {
            throw new IllegalStateException("Zahlungseinrichtung fehlgeschlagen: " + e.getMessage()
                    + " Dein Konto wurde trotzdem angelegt - du kannst die Zahlungsart im Mitgliederbereich nachtragen.", e);
        }
    }

    /**
     * Holt eine zuvor fehlgeschlagene Zahlungseinrichtung nach: setzt voraus, dass bereits ein
     * Stripe-Kunde existiert (member.stripeCustomerId) und dort eine Zahlungsart hinterlegt ist
     * (z.B. über das Stripe-Kundenportal nachgetragen).
     */
    @Transactional
    public MembershipContract retrySubscription(Member member) {
        if (member.getStripeCustomerId() == null) {
            throw new IllegalStateException("Für dieses Mitglied wurde noch keine Zahlungseinrichtung gestartet.");
        }
        if (member.getGitarrengruppe() == null) {
            throw new IllegalStateException("Keine Unterrichtsgruppe zugewiesen.");
        }

        PriceGroupRate rate = priceGroupService.effectiveRate(member.getGitarrengruppe().getPriceGroup().getId())
                .orElseThrow(() -> new IllegalStateException("Für die zugewiesene Gruppe ist kein Preis hinterlegt."));

        try {
            if (!stripeService.hasDefaultPaymentMethod(member.getStripeCustomerId())) {
                throw new IllegalStateException("Bitte zuerst über \"Zahlungsart verwalten\" eine Zahlungsart hinterlegen.");
            }
            String priceId = stripeService.ensureStripePrice(rate);
            if (!priceId.equals(rate.getStripePriceId())) {
                rate.setStripePriceId(priceId);
                priceGroupRateRepository.save(rate);
            }
            Subscription subscription = stripeService.createSubscription(member.getStripeCustomerId(), priceId);
            return saveContract(member, rate, member.getStripeCustomerId(), subscription.getId());
        } catch (StripeException e) {
            throw new IllegalStateException("Zahlungseinrichtung fehlgeschlagen: " + e.getMessage(), e);
        }
    }

    private MembershipContract saveContract(Member member, PriceGroupRate rate, String stripeCustomerId, String stripeSubscriptionId) {
        MembershipContract contract = MembershipContract.builder()
                .member(member)
                .priceGroupRate(rate)
                .stripeCustomerId(stripeCustomerId)
                .stripeSubscriptionId(stripeSubscriptionId)
                .status(MembershipContractStatus.ACTIVE)
                .startDate(LocalDate.now())
                .build();
        return membershipContractRepository.save(contract);
    }
}
