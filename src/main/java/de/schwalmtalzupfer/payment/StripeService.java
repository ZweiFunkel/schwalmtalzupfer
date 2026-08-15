package de.schwalmtalzupfer.payment;

import com.stripe.Stripe;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Event;
import com.stripe.model.PaymentMethod;
import com.stripe.model.Price;
import com.stripe.model.Product;
import com.stripe.model.SetupIntent;
import com.stripe.model.Subscription;
import com.stripe.model.billingportal.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.CustomerUpdateParams;
import com.stripe.param.PaymentMethodAttachParams;
import com.stripe.param.PriceCreateParams;
import com.stripe.param.ProductCreateParams;
import com.stripe.param.SetupIntentCreateParams;
import com.stripe.param.SubscriptionCreateParams;
import com.stripe.param.billingportal.SessionCreateParams;
import de.schwalmtalzupfer.pricing.PriceGroupRate;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Kapselt alle Stripe-API-Aufrufe. Kartendaten/IBAN laufen nie über unseren Server -
 * Stripe Elements/Payment Sheet sammelt clientseitig, wir sehen nur IDs/Tokens.
 */
@Service
public class StripeService {

    @Value("${app.stripe.secret-key}")
    private String secretKey;

    @Value("${app.stripe.publishable-key}")
    private String publishableKey;

    @Value("${app.stripe.webhook-secret}")
    private String webhookSecret;

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }

    public String publishableKey() {
        return publishableKey;
    }

    /**
     * @param idempotencyKey verhindert doppelte Kunden bei erneutem Aufruf (z.B. Seiten-Reload während der Registrierung).
     */
    public Customer createCustomer(String email, String idempotencyKey) throws StripeException {
        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(email)
                .build();
        RequestOptions options = RequestOptions.builder().setIdempotencyKey(idempotencyKey).build();
        return Customer.create(params, options);
    }

    public SetupIntent createSetupIntent(String customerId) throws StripeException {
        SetupIntentCreateParams params = SetupIntentCreateParams.builder()
                .setCustomer(customerId)
                .addPaymentMethodType("card")
                .addPaymentMethodType("sepa_debit")
                .build();
        return SetupIntent.create(params);
    }

    public void attachPaymentMethodAsDefault(String customerId, String paymentMethodId) throws StripeException {
        PaymentMethod paymentMethod = PaymentMethod.retrieve(paymentMethodId);
        if (!customerId.equals(paymentMethod.getCustomer())) {
            paymentMethod.attach(PaymentMethodAttachParams.builder().setCustomer(customerId).build());
        }
        Customer customer = Customer.retrieve(customerId);
        customer.update(CustomerUpdateParams.builder()
                .setInvoiceSettings(CustomerUpdateParams.InvoiceSettings.builder()
                        .setDefaultPaymentMethod(paymentMethodId)
                        .build())
                .build());
    }

    /** Legt bei Bedarf ein Stripe-Product+Price für die Rate an und gibt die Price-ID zurück. Persistiert selbst nichts in der DB. */
    public String ensureStripePrice(PriceGroupRate rate) throws StripeException {
        if (rate.getStripePriceId() != null) {
            return rate.getStripePriceId();
        }
        Product product = Product.create(ProductCreateParams.builder()
                .setName("Mitgliedsbeitrag – " + rate.getPriceGroup().getName())
                .build());
        Price price = Price.create(PriceCreateParams.builder()
                .setProduct(product.getId())
                .setCurrency("eur")
                .setUnitAmount((long) rate.getAmountCents())
                .setRecurring(PriceCreateParams.Recurring.builder()
                        .setInterval(PriceCreateParams.Recurring.Interval.MONTH)
                        .build())
                .build());
        return price.getId();
    }

    public Subscription createSubscription(String customerId, String priceId) throws StripeException {
        SubscriptionCreateParams params = SubscriptionCreateParams.builder()
                .setCustomer(customerId)
                .addItem(SubscriptionCreateParams.Item.builder().setPrice(priceId).build())
                .setCollectionMethod(SubscriptionCreateParams.CollectionMethod.CHARGE_AUTOMATICALLY)
                .build();
        return Subscription.create(params);
    }

    /** Prüft, ob der Kunde bereits eine Standard-Zahlungsart hinterlegt hat (für den Nachhol-Flow). */
    public boolean hasDefaultPaymentMethod(String customerId) throws StripeException {
        Customer customer = Customer.retrieve(customerId);
        return customer.getInvoiceSettings() != null
                && customer.getInvoiceSettings().getDefaultPaymentMethod() != null;
    }

    public Session createBillingPortalSession(String customerId, String returnUrl) throws StripeException {
        SessionCreateParams params = SessionCreateParams.builder()
                .setCustomer(customerId)
                .setReturnUrl(returnUrl)
                .build();
        return Session.create(params);
    }

    public Event constructWebhookEvent(String payload, String sigHeader) throws SignatureVerificationException {
        return Webhook.constructEvent(payload, sigHeader, webhookSecret);
    }
}
