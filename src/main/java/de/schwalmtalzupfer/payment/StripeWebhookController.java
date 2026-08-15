package de.schwalmtalzupfer.payment;

import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.Invoice;
import com.stripe.model.Subscription;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Stripe-Ereignisse (Zahlung fehlgeschlagen, Abo gekündigt) -> Vertragsstatus aktuell halten.
 * Signaturprüfung ist zwingend, sonst könnte jeder Aufrufer Vertragsstatus faken.
 */
@Slf4j
@RestController
@RequestMapping("/api/stripe")
@RequiredArgsConstructor
public class StripeWebhookController {

    private final StripeService stripeService;
    private final MembershipContractRepository membershipContractRepository;

    @PostMapping("/webhook")
    public ResponseEntity<?> webhook(HttpServletRequest request) throws IOException {
        String payload = new String(request.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        String sigHeader = request.getHeader("Stripe-Signature");

        Event event;
        try {
            event = stripeService.constructWebhookEvent(payload, sigHeader);
        } catch (SignatureVerificationException e) {
            log.warn("Ungültige Stripe-Webhook-Signatur: {}", e.getMessage());
            return ResponseEntity.status(400).build();
        }

        switch (event.getType()) {
            case "invoice.payment_failed" -> handleInvoicePaymentFailed(event);
            case "customer.subscription.deleted" -> handleSubscriptionDeleted(event);
            default -> log.debug("Unbehandeltes Stripe-Event: {}", event.getType());
        }

        return ResponseEntity.ok().build();
    }

    private void handleInvoicePaymentFailed(Event event) {
        deserialize(event, Invoice.class).ifPresent(invoice -> {
            String subscriptionId = invoice.getParent() != null && invoice.getParent().getSubscriptionDetails() != null
                    ? invoice.getParent().getSubscriptionDetails().getSubscription()
                    : null;
            if (subscriptionId == null) return;
            membershipContractRepository.findByStripeSubscriptionId(subscriptionId).ifPresent(contract -> {
                contract.setStatus(MembershipContractStatus.PAST_DUE);
                membershipContractRepository.save(contract);
            });
        });
    }

    private void handleSubscriptionDeleted(Event event) {
        deserialize(event, Subscription.class).ifPresent(subscription -> {
            membershipContractRepository.findByStripeSubscriptionId(subscription.getId()).ifPresent(contract -> {
                contract.setStatus(MembershipContractStatus.CANCELLED);
                contract.setCancelledAt(LocalDateTime.now());
                membershipContractRepository.save(contract);
            });
        });
    }

    private <T> Optional<T> deserialize(Event event, Class<T> type) {
        EventDataObjectDeserializer deserializer = event.getDataObjectDeserializer();
        return deserializer.getObject().map(type::cast);
    }
}
