package de.schwalmtalzupfer.payment;

import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.SetupIntent;
import de.schwalmtalzupfer.member.InvitationService;
import de.schwalmtalzupfer.member.InvitationToken;
import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final StripeService stripeService;
    private final InvitationService invitationService;
    private final MemberRepository memberRepository;
    private final MembershipContractRepository membershipContractRepository;
    private final RegistrationService registrationService;

    @GetMapping("/config")
    public Map<String, Object> config() {
        return Map.of("publishableKey", stripeService.publishableKey());
    }

    /**
     * Legt (idempotent) einen Stripe-Kunden für eine offene Beitritts-Einladung an und
     * gibt ein SetupIntent zurück, mit dem die Registrierungsseite Kartendaten/SEPA-Mandat
     * client-seitig einsammelt (Stripe Elements) - unser Server sieht dabei nie Rohdaten.
     */
    @PostMapping("/registration-intent")
    public ResponseEntity<?> registrationIntent(@RequestBody TokenRequest req) {
        InvitationToken invitation;
        try {
            invitation = invitationService.peekToken(req.token());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Ungültiges Token"));
        }
        if (invitation.isUsed() || invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(410).body(Map.of("error", "Einladung abgelaufen oder bereits verwendet"));
        }
        if (invitation.getPriceGroupRate() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Für diese Einladung ist kein Zahlungssetup nötig."));
        }

        try {
            Customer customer = stripeService.createCustomer(invitation.getEmail(), "beitritt-" + req.token());
            SetupIntent setupIntent = stripeService.createSetupIntent(customer.getId());
            return ResponseEntity.ok(Map.of(
                    "clientSecret", setupIntent.getClientSecret(),
                    "customerId", customer.getId(),
                    "amountCents", invitation.getPriceGroupRate().getAmountCents()
            ));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Stripe-Fehler: " + e.getMessage()));
        }
    }

    /**
     * Zahlungsstatus des eingeloggten Mitglieds (nie Kartendaten - nur Status/IDs).
     * SETUP_AUSSTEHEND = Stripe-Kunde existiert, aber noch kein aktives Abo (z.B. Karte wurde
     * bei der Registrierung abgelehnt) - kann über POST /retry-subscription nachgeholt werden.
     */
    @GetMapping("/method")
    public ResponseEntity<?> myPaymentStatus(Principal principal) {
        Member member = currentMember(principal);
        if (member == null) return ResponseEntity.status(401).build();

        return membershipContractRepository.findByMemberId(member.getId())
                .<ResponseEntity<?>>map(c -> ResponseEntity.ok(Map.of(
                        "status", c.getStatus().name(),
                        "startDate", c.getStartDate().toString(),
                        "amountCents", c.getPriceGroupRate().getAmountCents()
                )))
                .orElseGet(() -> ResponseEntity.ok(Map.of(
                        "status", member.getStripeCustomerId() != null ? "SETUP_AUSSTEHEND" : "KEIN_VERTRAG"
                )));
    }

    /** Öffnet das gehostete Stripe-Kundenportal (Karte/SEPA hinzufügen/ändern, Rechnungen einsehen). */
    @PostMapping("/portal-session")
    public ResponseEntity<?> portalSession(Principal principal, @RequestBody PortalRequest req) {
        Member member = currentMember(principal);
        if (member == null) return ResponseEntity.status(401).build();
        if (member.getStripeCustomerId() == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Kein Stripe-Kunde vorhanden"));
        }
        try {
            var session = stripeService.createBillingPortalSession(member.getStripeCustomerId(), req.returnUrl());
            return ResponseEntity.ok(Map.of("url", session.getUrl()));
        } catch (StripeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Stripe-Fehler: " + e.getMessage()));
        }
    }

    /**
     * Holt eine fehlgeschlagene Zahlungseinrichtung nach (Abo anlegen), nachdem im Kundenportal
     * eine Zahlungsart hinterlegt wurde. Legt keinen neuen Stripe-Kunden an.
     */
    @PostMapping("/retry-subscription")
    public ResponseEntity<?> retrySubscription(Principal principal) {
        Member member = currentMember(principal);
        if (member == null) return ResponseEntity.status(401).build();

        try {
            MembershipContract contract = registrationService.retrySubscription(member);
            return ResponseEntity.ok(Map.of(
                    "status", contract.getStatus().name(),
                    "startDate", contract.getStartDate().toString(),
                    "amountCents", contract.getPriceGroupRate().getAmountCents()
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private Member currentMember(Principal principal) {
        if (principal == null) return null;
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()))
                .orElse(null);
    }

    public record TokenRequest(String token) {}
    public record PortalRequest(String returnUrl) {}
}
