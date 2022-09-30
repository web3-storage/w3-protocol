import { capability, URI } from '@ucanto/validator'
// @ts-ignore
// eslint-disable-next-line no-unused-vars
import * as Ucanto from '@ucanto/interface'
import { canDelegateURI, equalWith } from './utils.js'

/**
 * @param {Ucanto.Failure | true} value
 */
function fail(value) {
  return value === true ? undefined : value
}

export const voucher = capability({
  can: 'voucher/*',
  with: URI.match({ protocol: 'did:' }),
  derives: equalWith,
})

export const claim = voucher.derive({
  to: capability({
    can: 'voucher/claim',
    with: URI.match({ protocol: 'did:' }),
    nb: {
      product: URI.match({ protocol: 'product:' }),
      identity: URI.match({ protocol: 'mailto:' }),
      service: URI.match({ protocol: 'did:' }),
    },
    derives: (child, parent) => {
      return (
        fail(equalWith(child, parent)) ||
        fail(canDelegateURI(child.nb.identity, parent.nb.identity)) ||
        fail(canDelegateURI(child.nb.product, parent.nb.product)) ||
        fail(canDelegateURI(child.nb.service, parent.nb.service)) ||
        true
      )
    },
  }),
  derives: equalWith,
})

export const redeem = voucher.derive({
  to: capability({
    can: 'voucher/redeem',
    with: URI.match({ protocol: 'did:' }),
    nb: {
      product: URI.match({ protocol: 'product:' }),
      identity: URI.match({ protocol: 'mailto:' }),
      account: URI.match({ protocol: 'did:' }),
    },
    derives: (child, parent) => {
      return (
        fail(equalWith(child, parent)) ||
        fail(canDelegateURI(child.nb.identity, parent.nb.identity)) ||
        fail(canDelegateURI(child.nb.product, parent.nb.product)) ||
        fail(canDelegateURI(child.nb.account, parent.nb.account)) ||
        true
      )
    },
  }),
  derives: equalWith,
})
