import * as ed25519 from '@ucanto/principal/ed25519'

/** did:key:z6MkrZ1r5XBFZjBU34qyD8fueMbMRkKw17BZaq2ivKFjnz2z */
export const serviceSigner = ed25519.parse(
  'MgCYKXoHVy7Vk4/QjcEGi+MCqjntUiasxXJ8uJKY0qh11e+0Bs8WsdqGK7xothgrDzzWD0ME7ynPjz2okXDh8537lId8='
)

const car = await randomCAR(128)

// Receipts
export const blobAddReceipt = await Receipt.issue({
  issuer: storefront,
  ran: filecoinOfferInvocation.cid,
  result: {
    ok: /** @type {Blob.BlobAddSuccess} */ ({
      piece,
    }),
  },
  fx: {
    join: car.cid,
    fork: [car.cid],
  },
})
