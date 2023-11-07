import assert from 'assert'
import { create as createServer, provide } from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import * as Signer from '@ucanto/principal/ed25519'
import * as SpaceCapabilities from '@web3-storage/capabilities/space'
import { mockService, mockServiceConf } from '../helpers/mocks.js'
import { Client, AgentData } from '../../src/client.js'
import { validateAuthorization } from '../helpers/utils.js'

describe('SpaceClient', () => {
  describe('info', () => {
    it('should retrieve space info', async () => {
      const service = mockService({
        space: {
          info: provide(SpaceCapabilities.info, ({ invocation }) => {
            assert.equal(invocation.issuer.did(), alice.agent.did())
            assert.equal(invocation.capabilities.length, 1)
            const invCap = invocation.capabilities[0]
            assert.equal(invCap.can, SpaceCapabilities.info.can)
            assert.equal(invCap.with, space.did())
            return {
              ok: {
                did: /** @type {`did:key:${string}`} */ (space.did()),
                providers: [],
              },
            }
          }),
        },
      })

      const server = createServer({
        id: await Signer.generate(),
        service,
        codec: CAR.inbound,
        validateAuthorization,
      })

      const alice = new Client(await AgentData.create(), {
        // @ts-ignore
        serviceConf: await mockServiceConf(server),
      })

      const space = await alice.createSpace('test')
      const auth = await space.createAuthorization(alice, {
        access: { 'space/info': {} },
        expiration: Infinity,
      })
      alice.addSpace(auth)
      await alice.setCurrentSpace(space.did())

      const info = await alice.capability.space.info(space.did())

      assert(service.space.info.called)
      assert.equal(service.space.info.callCount, 1)

      assert.equal(info.did, space.did())
      assert.deepEqual(info.providers, [])
    })
  })
})
