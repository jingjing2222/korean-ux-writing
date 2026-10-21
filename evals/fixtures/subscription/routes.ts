export const routeFacts = {
  '/billing/status': {
    purpose: 'Read the current payment status; this page never sends a payment request.',
    unavailable: 'The remote status screen is not supplied in this fixture.',
  },
  '/library': {
    purpose: 'Open the subscriber content library after a confirmed payment.',
    unavailable: 'The destination screen is not supplied in this fixture.',
  },
  '/billing/methods': {
    purpose: 'Manage stored payment methods; this route does not retry payment.',
    unavailable: 'The destination screen is not supplied in this fixture.',
  },
  '/support': {
    purpose: 'Open support contact options.',
    unavailable: 'The destination screen is not supplied in this fixture.',
  },
  '/plans': {
    purpose: 'Return to the plan comparison screen without charging the user.',
    unavailable: 'The destination screen is not supplied in this fixture.',
  },
};
