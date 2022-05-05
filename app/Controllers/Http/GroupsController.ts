import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Group from 'App/Models/Group'
import CreateGroupValidator from 'App/Validators/CreateGroupValidator'

export default class GroupsController {
  public async store({ request, response }: HttpContextContract) {
    const groupPlayload = await request.validate(CreateGroupValidator)
    const group = await Group.create(groupPlayload)

    await group.related('players').attach([groupPlayload.master])
    await group.load('players')

    return response.created({ group })
  }
}
