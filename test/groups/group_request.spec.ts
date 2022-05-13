import GroupRequest from 'App/Models/GroupRequest'
import User from 'App/Models/User'
import Database from '@ioc:Adonis/Lucid/Database'
import { GroupFactory, UserFactory } from 'Database/factories'
import test, { only } from 'japa'
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

  test('it should return list group requests by master', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})
    const groupRequest = response.body.groupRequest

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests?master=${master.id}`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(200)

    assert.exists(body.groupRequests, 'GroupRequests undefined')
    assert.equal(body.groupRequests.length, 1)
    assert.equal(body.groupRequests[0].id, groupRequest.id)
    assert.equal(body.groupRequests[0].userId, groupRequest.userId)
    assert.equal(body.groupRequests[0].groupId, groupRequest.groupId)
    assert.equal(body.groupRequests[0].status, groupRequest.status)
    assert.equal(body.groupRequests[0].group.name, group.name)
    assert.equal(body.groupRequests[0].user.username, globalUser.username)
    assert.equal(body.groupRequests[0].group.master, master.id)
  })

  test('it should return 422 when master is not provided', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .get(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)

    assert.equal(body.code, 'BAD_REQUEST')
    assert.equal(body.status, 422)
  })

  test('it should accept a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: globalUser.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/${body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(200)

    assert.exists(response.body.groupRequest, 'GroupRequest undefined')
    assert.equal(response.body.groupRequest.userId, globalUser.id)
    assert.equal(response.body.groupRequest.groupId, group.id)
    assert.equal(response.body.groupRequest.status, 'ACCEPTED')

    await group.load('players')
    assert.isNotEmpty(group.players)
    assert.equal(group.players.length, 1)
    assert.equal(group.players[0].id, globalUser.id)
  })

  test('it should return 404 when providing an unexisting group', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const response = await supertest(BASE_URL)
      .post(`/groups/123/requests/${body.groupRequest.id}/accept`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
  })

  test('it should return 404 when providing an unexisting group request', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const response = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests/123/accept`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
  })

  test('it should reject a group request', async (assert) => {
    const group = await GroupFactory.merge({ master: globalUser.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/${body.groupRequest.id}`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(200)

    const groupRequest = await GroupRequest.find(body.groupRequest.id)
    assert.isNull(groupRequest)
  })

  test('it should return 404 when providing an unexisting group for rejection', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    const { body } = await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const response = await supertest(BASE_URL)
      .delete(`/groups/123/requests/${body.groupRequest.id}`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
  })

  test('it should return 404 when providing an existing group request for rejection', async (assert) => {
    const master = await UserFactory.create()
    const group = await GroupFactory.merge({ master: master.id }).create()

    await supertest(BASE_URL)
      .post(`/groups/${group.id}/requests`)
      .set('Authorization', `Bearer ${globalToken}`)
      .send({})

    const response = await supertest(BASE_URL)
      .delete(`/groups/${group.id}/requests/123`)
      .set('Authorization', `Bearer ${globalToken}`)
      .expect(404)

    assert.equal(response.body.code, 'BAD_REQUEST')
    assert.equal(response.body.status, 404)
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
