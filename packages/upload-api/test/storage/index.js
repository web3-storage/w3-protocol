import { Registry as BlobRegistry } from './blob-registry.js'
import { CarStoreBucket } from './car-store-bucket.js'
import { StoreTable } from './store-table.js'
import { UploadTable } from './upload-table.js'
import { ProvisionsStorage } from './provisions-storage.js'
import { DelegationsStorage } from './delegations-storage.js'
import { RateLimitsStorage } from './rate-limits-storage.js'
import { RevocationsStorage } from './revocations-storage.js'
import { PlansStorage } from './plans-storage.js'
import { UsageStorage } from './usage-storage.js'
import { SubscriptionsStorage } from './subscriptions-storage.js'
import * as AgentStore from './agent-store.js'

/**
 * @param {object} options
 * @param {string[]} [options.providers]
 * @param {boolean} [options.requirePaymentPlan]
 * @param {import('http')} [options.http]
 * @param {{fail(error:unknown): unknown}} [options.assert]
 */
export async function getServiceStorageImplementations(options) {
  const storeTable = new StoreTable()
  const registry = new BlobRegistry()
  const uploadTable = new UploadTable()
  const carStoreBucket = await CarStoreBucket.activate(options)
  const revocationsStorage = new RevocationsStorage()
  const plansStorage = new PlansStorage()
  const usageStorage = new UsageStorage(storeTable, registry)
  const provisionsStorage = new ProvisionsStorage(options.providers)
  const subscriptionsStorage = new SubscriptionsStorage(provisionsStorage)
  const delegationsStorage = new DelegationsStorage()
  const rateLimitsStorage = new RateLimitsStorage()
  const agentStore = AgentStore.memory()

  return {
    storeTable,
    registry,
    uploadTable,
    carStoreBucket,
    revocationsStorage,
    plansStorage,
    usageStorage,
    provisionsStorage,
    subscriptionsStorage,
    delegationsStorage,
    rateLimitsStorage,
    agentStore,
  }
}
