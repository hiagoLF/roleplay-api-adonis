import BadRequest from 'App/Exceptions/BadRequestException'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Group from 'App/Models/Group'
import CreateGroupValidator from 'App/Validators/CreateGroupValidator'

export default class GroupsController {
  public async index({ request, response }: HttpContextContract) {
    return response.ok({})
  }

  public async store({ request, response }: HttpContextContract) {
    const groupPlayload = await request.validate(CreateGroupValidator)
    const group = await Group.create(groupPlayload)

    await group.related('players').attach([groupPlayload.master])
    await group.load('players')

    return response.created({ group })
  }

  public async removePlayer({ request, response }: HttpContextContract) {
    const groupId = request.param('groupId') as number
    const playerId = +request.param('playerId') as number

    const group = await Group.findOrFail(groupId)
    await group.load('players')

    if (playerId === group.master) throw new BadRequest('cannot remove master from group', 400)

    await group.related('players').detach([playerId])

    return response.ok({})
  }

  public async destroy({ request, response, bouncer }: HttpContextContract) {
    const id = request.param('id')
    const group = await Group.findOrFail(id)
    await bouncer.authorize('deleteGroup', group)

    await group.delete()
    return response.ok({})
  }

  public async update({ request, response, bouncer }: HttpContextContract) {
    const id = request.param('id')
    const payload = request.all()
    const group = await Group.findOrFail(id)
    await bouncer.authorize('updateGroup', group)
    const updatedGroup = await group.merge(payload).save()
    return response.ok({ group: updatedGroup })
  }
}
