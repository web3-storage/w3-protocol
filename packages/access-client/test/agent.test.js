/* eslint-disable no-unused-vars */
import assert from 'assert'
import * as ucanto from '@ucanto/core'
import { URI } from '@ucanto/validator'
import { Delegation, provide } from '@ucanto/server'
import { Agent, connection } from '../src/agent.js'
import * as Space from '@web3-storage/capabilities/space'
import * as UCAN from '@web3-storage/capabilities/ucan'
import { createServer } from './helpers/utils.js'
import * as fixtures from './helpers/fixtures.js'
import * as ed25519 from '@ucanto/principal/ed25519'
import { Access } from '@web3-storage/capabilities'
import { Absentee } from '@ucanto/principal'
import * as DidMailto from '@web3-storage/did-mailto'

describe('Agent', function () {
  it('should return did', async function () {
    const agent = await Agent.create()

    assert.ok(agent.did())
  })

  it('should create space', async function () {
    const agent = await Agent.create()
    const space = await agent.createSpace('test-create')

    assert(typeof space.did === 'string')
    assert(space.proof)
  })

  it('should add proof when creating acccount', async function () {
    const agent = await Agent.create()
    const space = await agent.createSpace('test-add')
    const delegations = agent.proofs()

    assert.equal(space.proof.cid, delegations[0].cid)
  })

  it('should set current space', async function () {
    const agent = await Agent.create()
    const space = await agent.createSpace('test')

    await agent.setCurrentSpace(space.did)

    const accWithMeta = await agent.currentSpaceWithMeta()
    if (!accWithMeta) {
      assert.fail('should have space')
    }
    assert.equal(accWithMeta.did, space.did)
    assert(accWithMeta.proofs.length === 1)
    assert.deepStrictEqual(accWithMeta.capabilities, ['*'])
  })

  it('fails set current space with no proofs', async function () {
    const agent = await Agent.create()

    await assert.rejects(
      () => {
        return agent.setCurrentSpace(fixtures.alice.did())
      },
      {
        message: `Agent has no proofs for ${fixtures.alice.did()}.`,
      }
    )
  })

  it('should allow import a space', async () => {
    const alice = await Agent.create()
    const bob = await Agent.create()

    const space = await alice.createSpace('videos')
    await alice.setCurrentSpace(space.did)

    const proof = await alice.delegate({
      audience: bob,
      audienceMeta: { name: 'videos', type: 'app' },
      abilities: ['*'],
    })

    await bob.importSpaceFromDelegation(proof)
    await bob.setCurrentSpace(space.did)

    const proofs = bob.proofs([{ can: 'store/add', with: space.did }])
    assert(proofs.length)
  })

  it('should allow import a space with restricted abilities', async () => {
    const alice = await Agent.create()
    const bob = await Agent.create()

    const space = await alice.createSpace('videos')
    await alice.setCurrentSpace(space.did)

    const proof = await alice.delegate({
      audience: bob,
      audienceMeta: { name: 'videos', type: 'app' },
      abilities: ['store/add'],
    })

    await bob.importSpaceFromDelegation(proof)
    await bob.setCurrentSpace(space.did)

    const proofs = bob.proofs([{ can: 'store/add', with: space.did }])
    assert(proofs.length)
  })

  it('should invoke and execute', async function () {
    const agent = await Agent.create(undefined, {
      connection: connection({ channel: createServer() }),
    })

    const space = await agent.createSpace('execute')
    await agent.setCurrentSpace(space.did)

    const { out } = await agent.invokeAndExecute(Space.info, {
      audience: fixtures.service,
    })

    assert.deepEqual(out.ok, {
      did: 'did:key:sss',
      agent: 'did:key:agent',
      email: 'mail@mail.com',
      product: 'product:free',
      updated_at: 'sss',
      inserted_at: 'date',
    })
  })

  it('should execute', async function () {
    const agent = await Agent.create(undefined, {
      connection: connection({ channel: createServer() }),
    })

    const space = await agent.createSpace('execute')
    await agent.setCurrentSpace(space.did)

    const i1 = await agent.invoke(Space.info, {
      audience: fixtures.service,
    })

    const receipts = await agent.execute(i1)

    assert.deepStrictEqual(
      receipts.map(($) => $.out),
      [
        {
          ok: {
            did: 'did:key:sss',
            agent: 'did:key:agent',
            email: 'mail@mail.com',
            product: 'product:free',
            updated_at: 'sss',
            inserted_at: 'date',
          },
        },
      ]
    )
  })

  it('should fail execute with no proofs', async function () {
    const agent = await Agent.create(undefined, {
      connection: connection({ channel: createServer() }),
    })

    await assert.rejects(
      async () => {
        await agent.invokeAndExecute(Space.info, {
          audience: fixtures.service,
          with: URI.from(fixtures.alice.did()),
        })
      },
      {
        name: 'Error',
        message: `no proofs available for resource ${URI.from(
          fixtures.alice.did()
        )} and ability space/info`,
      }
    )
  })

  it('should get space info', async function () {
    const server = createServer()
    const agent = await Agent.create(undefined, {
      connection: connection({ principal: server.id, channel: server }),
    })

    const space = await agent.createSpace('execute')
    await agent.setCurrentSpace(space.did)

    const out = await agent.getSpaceInfo()
    assert.deepEqual(out, {
      did: 'did:key:sss',
      agent: 'did:key:agent',
      email: 'mail@mail.com',
      product: 'product:free',
      updated_at: 'sss',
      inserted_at: 'date',
    })
  })

  it('should delegate', async function () {
    const server = createServer()
    const agent = await Agent.create(undefined, {
      connection: connection({ channel: server }),
    })

    const space = await agent.createSpace('execute')
    await agent.setCurrentSpace(space.did)

    const out = await agent.delegate({
      abilities: ['*'],
      audience: fixtures.alice,
      audienceMeta: {
        name: 'sss',
        type: 'app',
      },
    })

    assert(out.audience.did() === fixtures.alice.did())
    assert.deepStrictEqual(out.capabilities, [
      {
        can: '*',
        with: space.did,
      },
    ])
  })

  it('should not create delegation without proof', async function () {
    const server = createServer()
    const alice = await Agent.create(undefined, {
      connection: connection({ channel: server }),
    })
    const bob = await Agent.create(undefined, {
      connection: connection({ channel: server }),
    })

    const space = await alice.createSpace('execute')
    await alice.setCurrentSpace(space.did)

    const delegation = await alice.delegate({
      abilities: ['space/info'],
      audience: bob,
      audienceMeta: { name: 'sss', type: 'app' },
    })

    await bob.importSpaceFromDelegation(delegation)
    await bob.setCurrentSpace(space.did)

    // should not be able to store/remove - bob only has ability to space/info
    await assert.rejects(
      () =>
        bob.delegate({
          abilities: ['store/remove'],
          audience: fixtures.mallory,
          audienceMeta: { name: 'sss', type: 'app' },
        }),
      /cannot delegate capability store\/remove/
    )
  })

  it('should revoke', async function () {
    const server = createServer({
      ucan: {
        /**
         *
         * @type {import('@ucanto/interface').ServiceMethod<import('../src/types.js').UCANRevoke, import('../src/types.js').UCANRevokeSuccess, import('../src/types.js').UCANRevokeFailure>}
         */
        revoke: provide(UCAN.revoke, async ({ capability, invocation }) => {
          // copy a bit of the production revocation handler to do basic validation
          const { nb: input } = capability
          const ucan = Delegation.view(
            { root: input.ucan, blocks: invocation.blocks },
            // eslint-disable-next-line unicorn/no-null
            null
          )
          return ucan
            ? { ok: { time: Date.now() / 1000 } }
            : {
                error: {
                  name: 'UCANNotFound',
                  message: 'Could not find delegation in invocation blocks',
                },
              }
        }),
      },
    })
    const alice = await Agent.create(undefined, {
      connection: connection({ principal: server.id, channel: server }),
    })
    const bob = await Agent.create(undefined, {
      connection: connection({ principal: server.id, channel: server }),
    })
    const mallory = await Agent.create(undefined, {
      connection: connection({ principal: server.id, channel: server }),
    })

    const space = await alice.createSpace('alice')
    await alice.setCurrentSpace(space.did)

    const delegation = await alice.delegate({
      abilities: ['store/add'],
      audience: bob.issuer,
      audienceMeta: {
        name: 'sss',
        type: 'app',
      },
    })

    // revocation should work without a list of proofs
    const result = await alice.revoke(delegation.cid)
    assert(result.ok, `failed to revoke: ${result.error?.message}`)

    // and it should not fail if you pass additional proofs
    const result2 = await alice.revoke(delegation.cid, { proofs: [] })
    assert(
      result2.ok,
      `failed to revoke when proofs passed: ${result2.error?.message}`
    )

    await bob.importSpaceFromDelegation(delegation)
    await bob.setCurrentSpace(space.did)
    const bobDelegation = await bob.delegate({
      abilities: ['store/add'],
      audience: mallory.issuer,
      audienceMeta: {
        name: 'sss',
        type: 'app',
      },
    })

    // if the delegation wasn't generated by the agent and isn't passed, revoke will throw
    const result3 = await alice.revoke(bobDelegation.cid)
    assert(
      result3.error,
      `revoke resolved but should have rejected because delegation is not passed`
    )

    // but it should succeed if the delegation is passed
    const result4 = await alice.revoke(bobDelegation.cid, {
      proofs: [bobDelegation],
    })
    assert(
      result4.ok,
      `failed to revoke even though proof was passed: ${result4.error?.message}`
    )

    // bob should be able to revoke his own delegation
    const result5 = await bob.revoke(bobDelegation.cid)
    assert(result5.ok, `failed to revoke: ${result5.error?.message}`)
  })

  /**
   * An agent may manage a bunch of different proofs for the same agent key. e.g. proofs may authorize agent key to access various audiences or sessions on those audiences.
   * When one of the proofs is a session proof issued by w3upA or w3upB, the Agent#proofs result should contain proofs appropriate for the session host.
   */
  it('should include session proof based on connection', async () => {
    // const space = await ed25519.Signer.generate()
    const account = DidMailto.fromEmail(
      `test-${Math.random().toString().slice(2)}@dag.house`
    )
    const serviceA = await ed25519.Signer.generate()
    const serviceAWeb = serviceA.withDID('did:web:a.up.web3.storage')
    const serviceB = await ed25519.Signer.generate()
    const serviceBWeb = serviceB.withDID('did:web:b.up.web3.storage')

    const server = createServer()
    const agent = await Agent.create(undefined, {
      connection: connection({ channel: server }),
    })

    // the agent has a delegation+sesssion for each service
    const services = [serviceAWeb, serviceBWeb]
    for (const service of services) {
      const delegation = await ucanto.delegate({
        issuer: Absentee.from({ id: account }),
        audience: agent,
        capabilities: [
          {
            can: 'provider/add',
            with: 'ucan:*',
          },
        ],
      })
      const session = await Access.session.delegate({
        issuer: service,
        audience: agent,
        with: service.did(),
        nb: { proof: delegation.cid },
      })
      agent.addProof(delegation)
      agent.addProof(session)
    }

    // now let's say we want to send provider/add invocation to serviceB
    const desiredInvocationAudience = serviceAWeb
    const proofsA = agent.proofs(
      [
        {
          can: 'provider/add',
          with: account,
        },
      ],
      desiredInvocationAudience.did()
    )
    assert.ok(proofsA)
    assert.equal(proofsA[1].issuer.did(), desiredInvocationAudience.did())

    // TODO(bengo): Show that the proofs vary based on agent.connection.id (like w3cli does)
  })
})
