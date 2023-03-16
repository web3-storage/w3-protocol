import type { Logging } from '@web3-storage/worker-utils/logging'
import type {
  AccountTable,
  DelegationTable,
  SpaceTable,
} from '@web3-storage/access/types'
import type { Handler as _Handler } from '@web3-storage/worker-utils/router'
import { Spaces } from './models/spaces.js'
import { loadConfig } from './config.js'
import type { DID } from '@ucanto/interface'
import { ConnectionView, Signer as EdSigner } from '@ucanto/principal/ed25519'
import {
  DelegationStore,
  ProvisionStore,
  ConsumerStore,
  ValidationStore,
  AccountStore,
} from './types/index.js'

export {}

// CF Analytics Engine types not available yet
export interface AnalyticsEngine {
  writeDataPoint: (event: AnalyticsEngineEvent) => void
}

export interface AnalyticsEngineEvent {
  readonly doubles?: number[]
  readonly blobs?: Array<ArrayBuffer | string | null>
}

export interface Email {
  sendValidation: (input: { to: string; url: string }) => Promise<void>
  send: (input: {
    to: string
    textBody: string
    subject: string
  }) => Promise<void>
}

export interface Env {
  // vars
  ENV: string
  DEBUG: string
  /**
   * publicly advertised decentralized identifier of the running api service
   * * this may be used to filter incoming ucanto invocations
   */
  DID: `did:web:${string}`
  // URLs to upload-api so we proxy invocations to it
  UPLOAD_API_URL: string
  // secrets
  PRIVATE_KEY: string
  SENTRY_DSN: string
  POSTMARK_TOKEN: string
  POSTMARK_SENDER?: string

  DEBUG_EMAIL?: string
  LOGTAIL_TOKEN: string
  // bindings
  SPACES: KVNamespace
  VALIDATIONS: KVNamespace
  W3ACCESS_METRICS: AnalyticsEngine
  // eslint-disable-next-line @typescript-eslint/naming-convention
  __D1_BETA__: D1Database
}

export interface RouteContext {
  log: Logging
  signer: EdSigner.Signer<DID<'web'>>
  config: ReturnType<typeof loadConfig>
  url: URL
  email: Email
  models: {
    accounts: AccountStore
    delegations: DelegationStore
    spaces: Spaces
    provisions: ProvisionStore
    validations: ValidationStore
    consumers: ConsumerStore
    subscriptions: SubscriptionStore
  }
  uploadApi: ConnectionView
}

export type Handler = _Handler<RouteContext>

export type Bindings = Record<
  string,
  | KVNamespace
  | DurableObjectNamespace
  | CryptoKey
  | string
  | D1Database
  | AnalyticsEngine
>
declare namespace ModuleWorker {
  type FetchHandler<Environment extends Bindings = Bindings> = (
    request: Request,
    env: Environment,
    ctx: Pick<FetchEvent, 'waitUntil' | 'passThroughOnException'>
  ) => Promise<Response> | Response

  type CronHandler<Environment extends Bindings = Bindings> = (
    event: Omit<ScheduledEvent, 'waitUntil'>,
    env: Environment,
    ctx: Pick<ScheduledEvent, 'waitUntil'>
  ) => Promise<void> | void
}

export interface ModuleWorker {
  fetch?: ModuleWorker.FetchHandler<Env>
  scheduled?: ModuleWorker.CronHandler<Env>
}

// D1 types

export interface D1ErrorRaw extends Error {
  cause: Error & { code: string }
}

export interface D1Schema {
  spaces: SpaceTable
  accounts: AccountTable
  delegations: DelegationTable
}
