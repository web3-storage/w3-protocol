import { CarBlockIterator, CarWriter } from '@ipld/car'
import * as dagCBOR from '@ipld/dag-cbor'
import { varint } from 'multiformats'

/**
 * @typedef {import('@ipld/unixfs').Block} Block
 */

/** Byte length of a CBOR encoded CAR header with zero roots. */
const NO_ROOTS_HEADER_LENGTH = 17

/** @param {import('./types.js').AnyLink} [root] */
export function headerEncodingLength(root) {
  if (!root) return NO_ROOTS_HEADER_LENGTH
  const headerLength = dagCBOR.encode({ version: 1, roots: [root] }).length
  const varintLength = varint.encodingLength(headerLength)
  return varintLength + headerLength
}

/** @param {Block} block */
export function blockEncodingLength(block) {
  const payloadLength = block.cid.bytes.length + block.bytes.length
  const varintLength = varint.encodingLength(payloadLength)
  return varintLength + payloadLength
}

/**
 * @param {Iterable<Block> | AsyncIterable<Block>} blocks
 * @param {import('./types.js').AnyLink} [root]
 * @returns {Promise<import('./types.js').CARFile>}
 */
export async function encode(blocks, root) {
  // @ts-expect-error
  const { writer, out } = CarWriter.create(root)
  /** @type {Error?} */
  let error
  void (async () => {
    try {
      for await (const block of blocks) {
        await writer.put(block)
      }
    } catch (/** @type {any} */ err) {
      error = err
    } finally {
      await writer.close()
    }
  })()
  const chunks = []
  for await (const chunk of out) chunks.push(chunk)
  // @ts-expect-error
  if (error != null) throw error
  const roots = root != null ? [root] : []
  return Object.assign(new Blob(chunks), { version: 1, roots })
}

/** @extends {ReadableStream<Block>} */
export class BlockStream extends ReadableStream {
  /** @param {import('./types.js').BlobLike} car */
  constructor(car) {
    /** @type {Promise<CarBlockIterator>?} */
    let blocksPromise = null
    const getBlocksIterable = () => {
      if (blocksPromise) return blocksPromise
      blocksPromise = CarBlockIterator.fromIterable(toIterable(car.stream()))
      return blocksPromise
    }

    /** @type {AsyncIterator<Block>?} */
    let iterator = null
    super({
      async start() {
        const blocks = await getBlocksIterable()
        iterator = /** @type {AsyncIterator<Block>} */ (
          blocks[Symbol.asyncIterator]()
        )
      },
      async pull(controller) {
        /* c8 ignore next */
        if (!iterator) throw new Error('missing blocks iterator')
        const { value, done } = await iterator.next()
        if (done) return controller.close()
        controller.enqueue(value)
      },
    })

    /** @returns {Promise<import('./types.js').AnyLink[]>} */
    this.getRoots = async () => {
      const blocks = await getBlocksIterable()
      return await blocks.getRoots()
    }
  }
}

/* c8 ignore next 20 */
/**
 * @template T
 * @param {{ getReader: () => ReadableStreamDefaultReader<T> } | AsyncIterable<T>} stream
 * @returns {AsyncIterable<T>}
 */
function toIterable(stream) {
  return Symbol.asyncIterator in stream
    ? stream
    : (async function* () {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) return
            yield value
          }
        } finally {
          reader.releaseLock()
        }
      })()
}
