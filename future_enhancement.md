# Suggestions & Future Enhancements

1. **Online Payments (Stripe)**
   - Integrate Stripe Checkout; upon payment success mark order `paid` and transition to `confirmed`.
   - Offer both COD and card options.

2. **Delivery Zone Validation**
   - Admin draws a polygon on a map (e.g., barangay boundaries).
   - Checkout calls Edge Function to verify lat/lng is inside zone.

3. **Automated Cut‑off Scheduler**
   - Use `pg_cron` or a scheduled Supabase Edge Function to close slots when cut‑off passes (even if admin forgets).

4. **Customer Accounts & Order History**
   - Allow optional sign‑up/Supabase Auth to save addresses, reorder previous items, view past orders.

5. **Email & SMS Notifications**
   - Transactional emails: order confirmation, status update, delivery reminder.
   - SMS via Twilio for time‑sensitive updates (e.g., "Your pandesal is out for delivery").

6. **Inventory & Demand Forecasting**
   - Track SKU‑level daily orders vs available stock, generate production reports.

7. **Multi‑language Support (Filipino/English)**
   - i18n with react‑intl or Lingui.

8. **Analytics Dashboard**
   - Revenue by day, slot popularity, repeat customer rate.

9. **Progressive Web App (PWA)**
   - Add manifest and service worker for offline order lookup.

10. **Driver App (Future)**
   - Mobile view for riders to see assigned deliveries, update status, capture proof of delivery.