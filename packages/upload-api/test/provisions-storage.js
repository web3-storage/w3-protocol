import * as Types from '../src/types.js'

/**
 *
 * @param {Types.Provision} item
 * @returns {string}
 */
const itemKey = (item) => `${item.customer}@${item.provider}`

/**
 * @implements {Types.ProvisionsStorage}
 */
export class ProvisionsStorage {
  /**
   *
   * @param {Array<Types.ServiceDID | string>} providers
   */
  constructor(providers = ['did:web:test.web3.storage']) {
    /**
     * @type {Record<string, Types.Provision>}
     */
    this.provisions = {}
    this.providers = /** @type {Types.ServiceDID[]} */ (providers)
  }

  /**
   * @returns {Types.ServiceDID[]}
   */
  get services() {
    return this.providers
  }

  /**
   *
   * @param {Types.DIDKey} consumer
   */
  async hasStorageProvider(consumer) {
    return {
      ok: !!Object.values(this.provisions).find((i) => i.consumer === consumer),
    }
  }

  /**
   *
   * @param {Types.Provision} item
   * @returns
   */
  async put(item) {
    const storedItem = this.provisions[itemKey(item)]
    if (
      storedItem &&
      (storedItem.provider !== item.provider ||
        storedItem.customer !== item.customer ||
        storedItem.consumer !== item.consumer ||
        storedItem.cause.link() !== item.cause.link())
    ) {
      return {
        error: {
          name: 'Error',
          message: `could not store item - a provision with that key already exists`,
        },
      }
    } else {
      this.provisions[itemKey(item)] = item
      return { ok: {} }
    }
  }

  /**
   *
   * @param {Types.ProviderDID} provider
   * @param {Types.DID<'mailto'>} customer
   * @returns
   */
  async getCustomer(provider, customer) {
    const exists = Object.values(this.provisions).find(
      (p) => p.provider === provider && p.customer === customer
    )
    return exists
      ? { ok: { did: customer } }
      : {
          error: {
            name: 'CustomerNotFound',
            message: 'customer does not exist',
          },
        }
  }

  /**
   *
   * @param {Types.ProviderDID} provider
   * @param {string} subscription
   * @returns
   */
  async getSubscription(provider, subscription) {
    const provision = Object.values(this.provisions).find(
      (p) => p.customer === subscription && p.provider === provider
    )
    if (provision) {
      return { ok: provision }
    } else {
      return {
        error: {
          name: 'SubscriptionNotFound',
          message: `could not find ${subscription}`,
        },
      }
    }
  }

  /**
   *
   * @param {Types.ProviderDID} provider
   * @param {string} consumer
   * @returns
   */
  async getConsumer(provider, consumer) {
    const provision = Object.values(this.provisions).find(
      (p) => p.consumer === consumer && p.provider === provider
    )
    if (provision) {
      return {
        ok: {
          did: provision.consumer,
          allocated: 0,
          total: 100,
          subscription: provision.customer,
        },
      }
    } else {
      return {
        error: {
          name: 'ConsumerNotFound',
          message: `could not find ${consumer}`,
        },
      }
    }
  }

  async count() {
    return BigInt(Object.values(this.provisions).length)
  }
}
