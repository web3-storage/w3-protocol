import { context } from './helpers/context.js'
import { createTesterFromContext } from './helpers/ucanto-test-utils.js'
import * as principal from '@ucanto/principal'
import {
  Agent as AccessAgent,
  createDidMailtoFromEmail,
} from '@web3-storage/access/agent'
import * as w3caps from '@web3-storage/capabilities'
import * as assert from 'assert'
import * as Ucanto from '@ucanto/interface'
import { createEmail } from './helpers/utils.js'
import {
  stringToDelegation,
  stringToDelegations,
} from '@web3-storage/access/encoding'
import * as delegationsResponse from '../src/utils/delegations-response.js'
import { AgentData } from '@web3-storage/access'

for (const accessApiVariant of /** @type {const} */ ([
  {
    name: 'using access-api in miniflare',
    ...(() => {
      const account = {
        did: () => /** @type {const} */ ('did:mailto:dag.house:foo'),
      }
      const spaceWithStorageProvider = principal.ed25519.generate()
      async function createContext() {
        /** @type {{url:string}[]} */
        const emails = []
        const email = createEmail(emails)
        const ctx = await context({
          globals: {
            email,
          },
        })
        return {
          ...ctx,
          emails,
          connection: ctx.conn,
        }
      }
      return {
        spaceWithStorageProvider,
        ...createTesterFromContext(createContext, {
          account,
          registerSpaces: [spaceWithStorageProvider],
        }),
      }
    })(),
  },
])) {
  describe(`access-client-agent ${accessApiVariant.name}`, () => {
    it('can createSpace', async () => {
      const { connection } = await accessApiVariant.create()
      const accessAgent = await AccessAgent.create(undefined, {
        connection,
      })
      const space = await accessAgent.createSpace('test-add')
      const delegations = accessAgent.proofs()
      assert.equal(space.proof.cid, delegations[0].cid)
    })
    it('can requestAuthorization', async () => {
      const { connection, emails } = await accessApiVariant.create()
      const accessAgent = await AccessAgent.create(undefined, {
        connection,
      })
      const emailCount = emails.length
      const abort = new AbortController()
      after(() => abort.abort())
      await accessAgent.requestAuthorization('example@dag.house', {
        signal: abort.signal,
        capabilities: [{ can: '*' }],
      })
      assert.deepEqual(emails.length, emailCount + 1)
    })

    it('can testSessionAuthorization', async () => {
      const { connection, service, emails } = await accessApiVariant.create()
      const accessAgent = await AccessAgent.create(undefined, {
        connection,
      })
      /** @type {Ucanto.Principal<Ucanto.DID<'mailto'>>} */
      const account = { did: () => 'did:mailto:dag.house:example' }
      await testSessionAuthorization(
        await service,
        accessAgent,
        account,
        emails
      )
    })

    it('can requestAuthorization', async () => {
      const { connection } = await accessApiVariant.create()
      /** @type {Ucanto.Principal<Ucanto.DID<'mailto'>>} */
      const account = { did: () => 'did:mailto:dag.house:example' }
      const accessAgent = await AccessAgent.create(undefined, { connection })
      await requestAuthorization(accessAgent, account, [{ can: '*' }])
    })

    it('can authorize session with account and use', async () => {
      const { emails, connection } = await accessApiVariant.create()
      /** @type {Ucanto.Principal<Ucanto.DID<'mailto'>>} */
      const account = { did: () => 'did:mailto:dag.house:example' }
      const accessAgent = await AccessAgent.create(undefined, {
        connection,
      })

      // request that account authorizes accessAgent
      // this should result in sending a confirmation email
      const requestAllAbilities = requestAuthorization(accessAgent, account, [
        { can: '*' },
      ])

      // in parallel:
      // * request authorization
      // * keep checking your email for the confirmation email that sends, then return it
      // await both succeeding
      const abort = new AbortController()
      after(() => abort.abort())
      const [, confirmEmail] = await Promise.all([
        requestAllAbilities,
        watchForEmail(emails, 100, abort.signal).then((email) => {
          return email
        }),
      ])

      // extract confirmation invocation from email that was sent by service while handling access/authorize
      const confirm = await extractConfirmInvocation(new URL(confirmEmail.url))
      // invoke the access/confirm invocation as if the user had clicked the email
      const [confirmResult] = await connection.execute(confirm)
      assert.notEqual(
        confirmResult.error,
        true,
        'access/confirm result is not an error'
      )

      // these are delegations with audience=accessAgent.issuer
      const claimedAsAgent = await accessAgent.claimDelegations()
      assert.deepEqual(claimedAsAgent.length, 2)
      assert.ok(
        claimedAsAgent.every(
          (d) => d.audience.did() === accessAgent.issuer.did()
        )
      )

      // we expect these to have sessionProofs
      // one ucan/attest and one that is attested to
      const delegationFromAccountToSession = claimedAsAgent.find(
        (d) => d.issuer.did() === account.did()
      )
      assert.ok(
        delegationFromAccountToSession,
        'claimed delegationFromAccountToSession'
      )
      const attestation = claimedAsAgent.find(
        (d) => d.capabilities[0].can === 'ucan/attest'
      )
      assert.ok(attestation, 'claimed attestation')
      assert.equal(
        /** @type {any} */ (attestation).capabilities[0].nb.proof.toString(),
        delegationFromAccountToSession.cid.toString(),
        'ucan/attest proof cid matches delegation cid'
      )

      const accountProofs = [delegationFromAccountToSession, attestation]
      assert.ok(accountProofs)
      // @todo we should be able to use the accountProofs to provider/add
      // const providerAddResult = await accessAgent.invokeAndExecute()
    })

    it('can registerSpace', async () => {
      const { connection, emails } = await accessApiVariant.create()
      const accountEmail = 'foo@dag.house'
      const account = { did: () => createDidMailtoFromEmail(accountEmail) }
      const accessAgent = await AccessAgent.create(undefined, {
        connection,
      })
      const abort = new AbortController()
      after(() => abort.abort())

      // request agent authorization from account
      requestAuthorization(accessAgent, account, [{ can: '*' }])
      // confirm authorization
      const confirmationEmail = await watchForEmail(emails, 100, abort.signal)
      await confirmConfirmationUrl(accessAgent.connection, confirmationEmail)
      // claim delegations after confirmation
      await accessAgent.claimDelegations()

      // create space
      const spaceName = `space-test-${Math.random().toString().slice(2)}`
      const spaceCreation = await accessAgent.createSpace(spaceName)
      await accessAgent.setCurrentSpace(spaceCreation.did)

      // 'register space' - i.e. add a storage provider as an account
      await accessAgent.registerSpace(accountEmail, {
        provider: /** @type {Ucanto.DID<'web'>} */ (connection.id.did()),
      })
    })

    it('same agent, multiple accounts, provider/add', async () => {
      const accounts = ['test-a@dag.house', 'test-b@dag.house'].map(
        (email) => ({
          email,
          did: function thisEmailDidMailto() {
            return createDidMailtoFromEmail(this.email)
          },
        })
      )
      const { connection, emails } = await accessApiVariant.create()
      const accessAgentData = await AgentData.create()
      const accessAgent = await AccessAgent.create(accessAgentData, {
        connection,
      })
      const abort = new AbortController()
      after(() => abort.abort())

      for (const account of accounts) {
        // request agent authorization from account
        requestAuthorization(accessAgent, account, [{ can: '*' }])
        // confirm authorization
        const confirmationEmail = await watchForEmail(emails, 100, abort.signal)
        await confirmConfirmationUrl(accessAgent.connection, confirmationEmail)
        // claim delegations after confirmation
        await accessAgent.claimDelegations()
      }

      // create space
      const spaceName = `space-test-${Math.random().toString().slice(2)}`
      const spaceCreation = await accessAgent.createSpace(spaceName)
      await accessAgent.setCurrentSpace(spaceCreation.did)

      const provider = /** @type {Ucanto.DID<'web'>} */ (
        accessAgent.connection.id.did()
      )
      const accountsThatAddedProvider = []
      for (const account of accounts) {
        const proofsForAccount = accessAgent.proofs([
          {
            can: 'provider/add',
            with: spaceCreation.did,
          },
        ])
        // eslint-disable-next-line no-console
        console.log(
          'proofsForAccount',
          JSON.stringify(proofsForAccount, undefined, 2)
        )
        await accessAgent.addProvider(spaceCreation.did, account, provider)
        accountsThatAddedProvider.push(account)
      }

      assert.deepEqual(
        accountsThatAddedProvider.length,
        accounts.length,
        'all accounts added provider'
      )
    })

    it.skip('can can use second device with same account', () => {
      throw new Error('todo')
    })
  })
}

/**
 *
 * @param {Ucanto.ConnectionView<AccessService>} connection
 * @param {{ url: string|URL }} confirmation
 */
async function confirmConfirmationUrl(connection, confirmation) {
  // extract confirmation invocation from email that was sent by service while handling access/authorize
  const confirm = await extractConfirmInvocation(new URL(confirmation.url))
  // invoke the access/confirm invocation as if the user had clicked the email
  const [confirmResult] = await connection.execute(confirm)
  assert.notEqual(
    confirmResult.error,
    true,
    'access/confirm result is not an error'
  )
}

/**
 * @param {URL} confirmationUrl
 * @returns {Promise<Ucanto.Invocation<AccessConfirm>>}
 */
async function extractConfirmInvocation(confirmationUrl) {
  const delegation = stringToDelegation(
    confirmationUrl.searchParams.get('ucan') ?? ''
  )
  if (
    delegation.capabilities.length !== 1 ||
    delegation.capabilities[0].can !== 'access/confirm'
  ) {
    throw new Error(`parsed unexpected delegation from confirmationUrl`)
  }
  const confirm = /** @type {Ucanto.Invocation<AccessConfirm>} */ (delegation)
  return confirm
}

/**
 * @param {Array<{ url: string }>} emails
 * @param {number} [retryAfter]
 * @param {AbortSignal} [abort]
 * @returns {Promise<{ url: string }>} latest email, once received
 */
function watchForEmail(emails, retryAfter, abort) {
  return new Promise((resolve, reject) => {
    if (abort) {
      abort.addEventListener('abort', () => reject(new Error('aborted')))
    }
    const latestEmail = emails.at(-1)
    if (latestEmail) {
      return resolve(latestEmail)
    }
    if (typeof retryAfter === 'number') {
      setTimeout(
        () => watchForEmail(emails, retryAfter).then(resolve).catch(reject),
        retryAfter
      )
    }
  })
}

/**
 * @typedef {import('./provider-add.test.js').AccessAuthorize} AccessAuthorize
 * @typedef {import('@web3-storage/capabilities/src/types.js').AccessConfirm} AccessConfirm
 * @typedef {import('./helpers/ucanto-test-utils.js').AccessService} AccessService
 */

/**
 * request authorization using access-api access/authorize
 *
 * @param {AccessAgent} access
 * @param {Ucanto.Principal<Ucanto.DID<'mailto'>>} authorizer - who you are requesting authorization from
 * @param {Iterable<{ can: Ucanto.Ability }>} abilities - e.g. [{ can: '*' }]
 */
async function requestAuthorization(access, authorizer, abilities) {
  const authorizeResult = await access.invokeAndExecute(
    w3caps.Access.authorize,
    {
      audience: access.connection.id,
      with: access.issuer.did(),
      nb: {
        iss: authorizer.did(),
        att: [...abilities],
      },
    }
  )
  assert.notDeepStrictEqual(
    authorizeResult.error,
    true,
    'authorize result is not an error'
  )
}

/**
 * @param {principal.ed25519.Signer.Signer<`did:web:${string}`, principal.ed25519.Signer.UCAN.SigAlg>} service
 * @param {AccessAgent} access
 * @param {Ucanto.Principal<Ucanto.DID<'mailto'>>} account
 * @param {{url:string}[]} emails
 */
async function testSessionAuthorization(service, access, account, emails) {
  const authorizeResult = await access.invokeAndExecute(
    w3caps.Access.authorize,
    {
      audience: access.connection.id,
      with: access.issuer.did(),
      nb: {
        iss: account.did(),
        att: [{ can: '*' }],
      },
    }
  )
  assert.notDeepStrictEqual(
    authorizeResult.error,
    true,
    'authorize result is not an error'
  )

  const latestEmail = emails.at(-1)
  assert.ok(latestEmail, 'received a confirmation email')
  const confirmationInvocations = stringToDelegations(
    new URL(latestEmail.url).searchParams.get('ucan') ?? ''
  )
  assert.deepEqual(confirmationInvocations.length, 1)
  const serviceSaysAccountCanConfirm =
    /** @type {Ucanto.Invocation<import('@web3-storage/capabilities/src/types.js').AccessConfirm>} */ (
      confirmationInvocations[0]
    )

  const confirm = await w3caps.Access.confirm
    .invoke({
      nb: {
        ...serviceSaysAccountCanConfirm.capabilities[0].nb,
      },
      issuer: service,
      audience: access.connection.id,
      with: access.connection.id.did(),
      proofs: [serviceSaysAccountCanConfirm],
    })
    .delegate()

  const [confirmationResult] = await access.connection.execute(confirm)
  assert.notDeepStrictEqual(
    confirmationResult.error,
    true,
    'confirm result is not an error'
  )

  const claimResult = await access.invokeAndExecute(w3caps.Access.claim, {
    with: access.issuer.did(),
  })
  assert.notDeepEqual(
    claimResult.error,
    true,
    'access/claim result is not an error'
  )
  assert.ok(!claimResult.error)
  const claimedDelegations1 = [
    ...delegationsResponse.decode(claimResult.delegations),
  ]
  assert.ok(claimedDelegations1.length > 0, 'claimed some delegations')
}
