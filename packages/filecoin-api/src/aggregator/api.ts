import type { Signer, Principal, Link, ConnectionView } from '@ucanto/interface'
import { InclusionProof } from '@web3-storage/capabilities/types'
import { PieceLink } from '@web3-storage/data-segment'
import { InvocationConfig } from '@web3-storage/filecoin-client/types'
import { Store, UpdatableStore, QueryableStore, Queue } from '../types.js'

export interface ServiceContext {
  /**
   * Service signer
   */
  id: Signer
  /**
   * Principal for dealer service
   */
  dealerId: Principal
  /**
   * Stores pieces that have been offered to the aggregator.
   */
  pieceStore: UpdatableStore<PieceRecordKey, PieceRecord>
  /**
   * Queues pieces being buffered into an aggregate.
   */
  pieceQueue: Queue<PieceMessage>
  /**
   * Queues pieces being buffered into an aggregate.
   */
  bufferQueue: Queue<BufferMessage>
  /**
   * Store of CID => Buffer Record
   */
  bufferStore: Store<Link, BufferRecord>
  /**
   * Stores fully buffered aggregates.
   */
  aggregateStore: Store<AggregateRecordKey, AggregateRecord>
  /**
   * Queues pieces, their aggregate and their inclusion proofs.
   */
  pieceAcceptQueue: Queue<PieceAcceptMessage>
  /**
   * Stores inclusion proofs for pieces included in an aggregate.
   */
  inclusionStore: QueryableStore<
    InclusionRecordKey,
    InclusionRecord,
    InclusionRecordQueryByGroup
  >
  /**
   * Queues buffered aggregates to be offered to the Dealer.
   */
  aggregateOfferQueue: Queue<AggregateOfferMessage>
}

export interface PieceMessageContext
  extends Pick<ServiceContext, 'pieceStore'> {}

export interface PieceAcceptMessageContext
  extends Pick<ServiceContext, 'inclusionStore'> {}

export interface AggregateOfferMessageContext
  extends Pick<ServiceContext, 'aggregateStore'> {}

export interface PieceInsertEventContext
  extends Pick<ServiceContext, 'bufferStore' | 'bufferQueue'> {}

export interface InclusionInsertEventToUpdateState
  extends Pick<ServiceContext, 'pieceStore'> {}

export interface InclusionInsertEventToIssuePieceAccept {
  /**
   * Aggregator connection to moves pieces into the pipeline.
   */
  aggregatorConnection: ConnectionView<any>
  /**
   * Invocation configuration.
   */
  aggregatorInvocationConfig: InvocationConfig
}

export interface AggregateInsertEventToPieceAcceptQueueContext
  extends Pick<ServiceContext, 'bufferStore' | 'pieceAcceptQueue'> {
  /**
   * Buffer configuration for aggregation.
   */
  config: AggregateConfig
}

export interface AggregateInsertEventToAggregateOfferContext
  extends Pick<ServiceContext, 'bufferStore'> {
  /**
   * Dealer connection to offer aggregates for deals.
   */
  dealerConnection: ConnectionView<any>
  /**
   * Invocation configuration.
   */
  dealerInvocationConfig: InvocationConfig
}

export interface BufferMessageContext
  extends Pick<
    ServiceContext,
    'bufferStore' | 'bufferQueue' | 'aggregateOfferQueue'
  > {
  /**
   * Buffer configuration for aggregation.
   */
  config: AggregateConfig
}

export interface PieceRecord {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Status of the offered piece.
   * - offered = acknowledged received for aggregation.
   * - accepted = accepted into an aggregate and offered for inclusion in filecoin deal(s).
   */
  status: 'offered' | 'accepted'
  /**
   * Insertion date in milliseconds since unix epoch.
   */
  insertedAt: number
  /**
   * Update date in milliseconds since unix epoch.
   */
  updatedAt: number
}

export interface PieceRecordKey extends Pick<PieceRecord, 'piece' | 'group'> {}

export interface PieceMessage {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
}

export interface AggregateRecord {
  /**
   * `bagy...aggregate` Piece CID of an aggregate
   */
  aggregate: PieceLink
  /**
   * `bafy...cbor` as CID of dag-cbor block with list of pieces in an aggregate.
   */
  pieces: Link
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Insertion date in milliseconds since unix epoch.
   */
  insertedAt: number
}

// TODO: probably group should also be key!
export interface AggregateRecordKey
  extends Pick<AggregateRecord, 'aggregate'> {}

export interface InclusionRecord {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * Piece CID of an aggregate.
   */
  aggregate: PieceLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Proof that the piece is included in the aggregate.
   */
  inclusion: InclusionProof
  /**
   * Insertion date in milliseconds since unix epoch.
   */
  insertedAt: number
}

export interface InclusionRecordKey
  extends Pick<InclusionRecord, 'piece' | 'aggregate'> {}

export interface InclusionRecordQueryByGroup
  extends Pick<InclusionRecord, 'piece' | 'group'> {}

export type BufferedPiece = {
  /**
   * Piece CID for the content.
   */
  piece: PieceLink
  /**
   * Policies that this piece is under
   */
  policy: PiecePolicy
  /**
   * Insertion date in milliseconds since unix epoch.
   */
  insertedAt: number
}

export interface Buffer {
  /**
   * `bagy...aggregate` Piece CID of an aggregate
   */
  aggregate?: PieceLink
  /**
   * Pieces inside the buffer record.
   */
  pieces: BufferedPiece[]
  /**
   * Grouping information for submitted buffer.
   */
  group: string
}

export interface BufferRecord {
  /**
   * Buffer with a set of Filecoin pieces pending aggregation.
   */
  buffer: Buffer
  /**
   * `bafy...cbor` as CID of dag-cbor block with list of pieces in an aggregate.
   */
  block: Link
}

export interface BufferMessage {
  /**
   * `bagy...aggregate` Piece CID of an aggregate
   */
  aggregate?: PieceLink
  /**
   * `bafy...cbor` as CID of dag-cbor block with Buffer
   */
  pieces: Link
  /**
   * Grouping information for submitted buffer.
   */
  group: string
}

export interface PieceAcceptMessage {
  /**
   * Piece CID.
   */
  piece: PieceLink
  /**
   * Piece CID of an aggregate
   */
  aggregate: PieceLink
  /**
   * Grouping information for submitted piece.
   */
  group: string
  /**
   * Proof that the piece is included in the aggregate.
   */
  inclusion: InclusionProof
}

export interface AggregateOfferMessage {
  /**
   * Link to the task invocation for `aggregate/offer`.
   */
  // TODO: do we need?
  task?: Link
  /**
   * Piece CID of an aggregate.
   */
  aggregate: PieceLink
  /**
   * List of pieces in an aggregate.
   */
  pieces: Link
  /**
   * Grouping information for submitted piece.
   */
  group: string
}

export interface TestEventsContext
  extends PieceMessageContext,
    PieceAcceptMessageContext,
    AggregateOfferMessageContext,
    PieceInsertEventContext,
    InclusionInsertEventToUpdateState,
    InclusionInsertEventToIssuePieceAccept,
    AggregateInsertEventToAggregateOfferContext,
    AggregateInsertEventToPieceAcceptQueueContext,
    BufferMessageContext {
  id: Signer
  service: Partial<{
    filecoin: Partial<import('../types').StorefrontService['filecoin']>
    piece: Partial<import('../types').AggregatorService['piece']>
    aggregate: Partial<import('../../src/types').DealerService['aggregate']>
    deal: Partial<import('../../src/types').DealTrackerService['deal']>
  }>
}

export interface AggregateConfig {
  maxAggregateSize: number
  minAggregateSize: number
  minUtilizationFactor: number
}

// Enums
export type PiecePolicy = NORMAL | RETRY

type NORMAL = 0
type RETRY = 1