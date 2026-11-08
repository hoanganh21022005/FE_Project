const authoritiesOf = (user) =>
  Array.isArray(user?.authorities)
    ? user.authorities.map((authority) => String(authority).trim().toUpperCase())
    : [];

export function hasAuthority(user, authority) {
  return authoritiesOf(user).includes(String(authority || "").trim().toUpperCase());
}

export function canViewInvoices(user) {
  return hasAuthority(user, "MANAGE_INVOICES");
}

export function canViewMemberSubscriptions(user) {
  return hasAuthority(user, "MANAGE_USERS") || hasAuthority(user, "MANAGE_SUBSCRIPTIONS");
}

export function canConfirmCash(user) {
  const role = String(user?.role || "").trim().toUpperCase().replace(/^ROLE_/, "");
  return role === "RECEPTIONIST" && hasAuthority(user, "MANAGE_INVOICES");
}

export function isCashInvoiceConfirmable(invoice, now = Date.now()) {
  if (!invoice) return false;

  const status = String(invoice.paymentStatus || invoice.status || "").trim().toLowerCase();
  const method = String(invoice.paymentMethod || invoice.rawPaymentMethod || invoice.method || "")
    .trim()
    .toLowerCase();
  const parseBackendDate = (value) => {
    const text = String(value || "").trim();
    if (!text) return Number.NaN;
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
    return Date.parse(hasZone ? text : `${text}+07:00`);
  };
  const expiresAt = parseBackendDate(invoice.expiresAt);
  const backendNow = parseBackendDate(invoice.serverTime);
  const referenceNow = Number.isFinite(backendNow) ? backendNow : now;

  return status === "pending"
    && ["cash", "tiền mặt", "tien_mat"].includes(method)
    && Number.isFinite(expiresAt)
    && expiresAt > referenceNow
    && invoice.reconciliationRequired !== true;
}
