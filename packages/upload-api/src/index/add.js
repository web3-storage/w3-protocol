import * as Server from '@ucanto/server'
import { ok, error } from '@ucanto/server'
import * as Index from '@web3-storage/capabilities/index'
import { ShardedDAGIndex } from '@web3-storage/blob-index'
import { concat } from 'uint8arrays'
import * as API from '../types.js'

/**
 * @param {API.IndexServiceContext} context
 * @returns {API.ServiceMethod<API.IndexAdd, API.IndexAddSuccess, API.IndexAddFailure>}
 */
export const provide = (context) =>
  Server.provide(Index.add, (input) => add(input, context))

/**
 * @param {API.Input<Index.add>} input
 * @param {API.IndexServiceContext} context
 * @returns {Promise<API.Result<API.IndexAddSuccess, API.IndexAddFailure>>}
 */
const add = async ({ capability }, context) => {
  const space = capability.with
  const idxLink = capability.nb.index

  // ensure the index was stored in the agent's space
  const idxAllocRes = await assertAllocated(
    context,
    space,
    idxLink.multihash,
    'IndexNotFound'
  )
  if (!idxAllocRes.ok) return idxAllocRes

  // fetch the index from the network
  const idxBlobRes = await context.blobRetriever.stream(idxLink.multihash)
  if (!idxBlobRes.ok) {
    if (idxBlobRes.error.name === 'BlobNotFound') {
      return error(
        /** @type {API.IndexNotFound} */
        ({ name: 'IndexNotFound', digest: idxLink.multihash.bytes })
      )
    }
    return idxBlobRes
  }

  /** @type {Uint8Array[]} */
  const chunks = []
  await idxBlobRes.ok.pipeTo(
    new WritableStream({
      write: (chunk) => {
        chunks.push(chunk)
      },
    })
  )

  const idxRes = ShardedDAGIndex.extract(concat(chunks))
  if (!idxRes.ok) return idxAllocRes

  // ensure indexed shards are allocated in the agent's space
  const shardDigests = [...idxRes.ok.shards.keys()]
  const shardAllocRes = await Promise.all(
    shardDigests.map((s) => assertAllocated(context, space, s, 'ShardNotFound'))
  )
  for (const res of shardAllocRes) {
    if (!res.ok) return res
  }

  // TODO: randomly validate slices in the index correspond to slices in the blob

  // publish the index data to IPNI
  return context.ipniService.publish(idxRes.ok)
}

/**
 * @param {{ allocationsStorage: import('../types.js').AllocationsStorage }} context
 * @param {API.SpaceDID} space
 * @param {import('multiformats').MultihashDigest} digest
 * @param {'IndexNotFound'|'ShardNotFound'|'SliceNotFound'} errorName
 * @returns {Promise<API.Result<API.Unit, API.IndexNotFound|API.ShardNotFound|API.SliceNotFound|API.Failure>>}
 */
const assertAllocated = async (context, space, digest, errorName) => {
  const result = await context.allocationsStorage.exists(space, digest)
  if (result.error) return result
  if (!result.ok)
    return error(
      /** @type {API.IndexNotFound|API.ShardNotFound|API.SliceNotFound} */
      ({ name: errorName, digest: digest.bytes })
    )
  return ok({})
}
