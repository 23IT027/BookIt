const Stripe = require('stripe');
const config = require('./env');

let stripe = null;

const initializeStripe = () => {
  if (!config.stripe.secretKey) {
    console.warn('⚠️  Stripe secret key not configured - payment features will be disabled');
    return null;
  }

  try {
    stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2023-10-16',
    });
    console.log('✅ Stripe initialized');
    return stripe;
  } catch (error) {
    console.error('❌ Stripe initialization failed:', error.message);
    return null;
  }
};

const getStripeClient = () => {
  if (!stripe) {
    stripe = initializeStripe();
  }
  return stripe;
};

module.exports = {
  initializeStripe,
  getStripeClient
};
