import User from 'App/Models/User'
import Database from '@ioc:Adonis/Lucid/Database'
import { GroupFactory, UserFactory } from 'Database/factories'
import test from 'japa'
import supertest from 'supertest'

const BASE_URL = `http://${process.env.HOST}:${process.env.PORT}`
let globalUser = {} as User
let globalToken = ''

test.group('Group Request', (group) => {
  test('it should create a group request', async (assert) => {
    const user = await UserFactory.create()
    const group = await GroupFactory.merge({ master: user.id }).create()
    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    assert.exists(body.groupRequest, 'Group request undefined')
    assert.equal(body.groupRequest.userId, globalUser.id)
    assert.equal(body.groupRequest.groupId, group.id)
    assert.exists(body.groupRequest.status, 'PENDING')
  })

  test('it should return 409 when group request already exists', async (assert) => {
    const user = await UserFactory.create()
    const group = await GroupFactory.merge({ master: user.id }).create()
    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 409)
  })

  test('it should return 422 when user is already in the group', async (assert) => {
    const groupPayload = {
      name: 'test',
      description: 'test',
      schedule: 'test',
      location: 'test',
      chronic: 'test',
      master: globalUser.id,
    }

    const response = await supertest(BASE_URL)
      .post('/groups')
      .set('Authorization', `Bearer ${globalToken}`)
      .send(groupPayload)

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${response.body.group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  group.before(async () => {
    const plainPassword = 'test'
    const user = await UserFactory.merge({ password: plainPassword }).create()
    const { body } = await supertest(BASE_URL)
      .post('/sessions')
      .send({ email: user.email, password: plainPassword })
      .expect(201)
    globalToken = body.token.token
    globalUser = user
  })

  group.after(async () => {
    await supertest(BASE_URL).delete('/sessions').set('Authorization', `Bearer ${globalToken}`)
  })

  group.beforeEach(async () => {
    await Database.beginGlobalTransaction()
  })

  group.afterEach(async () => {
    await Database.rollbackGlobalTransaction()
  })
})
