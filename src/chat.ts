import express from 'express'
import { db, makeError, Res } from '.'
import { ObjectId, PullOperator, PushOperator } from 'mongodb'
import { chatsSchema, messageSchema } from './validations'
import { connections } from './ws'
import { z } from 'zod'

const router = express.Router()
const chatdb = db.collection('Chats')
const messages = db.collection('Messages')
const userdb = db.collection('Users')

router.get('/', async (req: express.Request, res: Res) => {
    const { chatIds } = req.user!
    if (!chatIds) return res.send({ status: 200, chats: [] });
    try {
        const chats = await chatdb.find({ _id: { $in: chatIds } }, { projection: { name: 1, avatar: 1, direct: 1, createdBy: 1 } }).toArray()
        res.send({ status: 200, chats })
    } catch (err) { makeError(500, res)(err) }
})

router.post('/create', async (req: express.Request, res: Res) => {
    try {
        const parsed = chatsSchema.parse(req.body)
        if (!parsed.memberIds.includes(req.user._id) || parsed.memberIds.length < 2 || parsed.createdBy !== req.user._id || [...new Set(parsed.memberIds)].filter(x => !req.user._id.equals(x)).includes(req.user._id)) return makeError(400, res);
        if (parsed.direct == true) return makeError(1008, res);
        let precheck = await chatdb.findOne({ _id: parsed._id })
        if (precheck != null) return makeError(409, res);
        if ([...new Set(parsed.memberIds)].length !== parsed.memberIds.length) return makeError(1009, res);
        let users = await userdb.countDocuments({ _id: { $in: parsed.memberIds } })
        if (users != parsed.memberIds.length) return makeError(404, res);
        const nchat = await chatdb.insertOne(parsed)
        await userdb.updateMany({ _id: { $in: parsed.memberIds } }, { $push: { chatIds: nchat.insertedId } } as PushOperator<Document>)
        res.status(201).send({ status: 201, chatId: nchat.insertedId })
    } catch (err) { makeError(400, res)(err) }
})

router.delete('/delete', async (req: express.Request, res: Res) => {
    try {
        const parsed = z.object({
            _id: z.string().transform(v => new ObjectId(v))
        }).parse(req.body)
        if (!req.user.chatIds.find(x => parsed._id.equals(x))) return makeError(403, res);
        const chat = await chatdb.findOne({ _id: parsed._id })
        if (!chat) {
            await userdb.updateMany({ chatIds: parsed._id }, { $pull: { chatIds: parsed._id } } as PullOperator<Document>)
            return makeError(404, res);
        }
        if (!chat.memberIds.includes(req.user._id)) {
            await userdb.updateMany({ $and: [{ chatIds: parsed._id }, { _id: { $nin: chat.memberIds } }] }, { $pull: { chatIds: parsed._id } } as PullOperator<Document>)
            return makeError(403, res);
        }
        if (!parsed._id.equals(chat.createdBy)) return makeError(403, res);
        await messages.deleteMany({ _id: { $in: chat.messageIds } })
        await chatdb.deleteOne({ _id: chat._id })
        connections.filter(x => chat.memberIds.includes(x.user._id)).forEach(x => x.ws?.send(JSON.stringify({ event: "ChatDeleted", data: { chatId: parsed._id } })))
        res.status(204).send({ status: 204 })
    } catch (err) { makeError(500, res)(err) }
})

router.get('/:id', async (req: express.Request, res: Res) => {
    if (!req.user.chatIds.find(x => x.toString() == req.params.id)) return makeError(403, res); // idk why it doesn't work with .includes(req.params.id)
    try {
        const chat = await chatdb.aggregate([
            {
                $match: { _id: new ObjectId(req.params.id as string) }
            }, {
                $lookup: {
                    from: 'Messages',
                    localField: 'messageIds',
                    foreignField: '_id',
                    as: 'messages'
                }
            }, {
                $project: {
                    messageIds: 0
                }
            }
        ]).toArray()
        if (!chat) return makeError(404, res)();
        res.send({ status: 200, chat })
    } catch (err) { makeError(500, res)(err) }
})

router.post('/:id/messages', async (req: express.Request, res: Res) => {
    try {
        const message = messageSchema.parse(req.body)
        if (!req.user._id.equals(message.createdBy) || req.user._id.equals(message.chatId)) return makeError(400, res);
        let cht = await chatdb.findOne({ _id: message.chatId })
        if (!cht) {
            const user = await userdb.findOne({ _id: message.chatId })
            if (!user) return makeError(1006, res);
            message.readBy = [req.user._id]
            const msg = await messages.insertOne(message)
            let chat = await chatdb.insertOne({ avatar: req.user.avatar, direct: true, createdBy: req.user._id, messageIds: [msg.insertedId], memberIds: [user._id, req.user._id] })
            await userdb.updateMany({ _id: { $in: [req.user._id, user._id] } }, { $push: { chatIds: chat.insertedId } } as PushOperator<Document>)
            connections.find(x => user._id.equals(x.user._id))?.ws?.send(JSON.stringify({ event: "ChatCreated", data: { avatar: req.user.avatar, direct: true, createdBy: req.user._id, messageIds: [msg.insertedId], memberIds: [user._id, req.user._id], createdAt: new Date() } }));
            return res.status(201).send({ status: 201, messageId: msg.insertedId, chatId: chat.insertedId })
        } else {
            const msg = await messages.insertOne(message)
            cht?.memberIds?.forEach((x: ObjectId) => {
                if (req.user._id.equals(x)) return;
                connections.find(cn => cn.user._id.equals(x))?.ws?.send(JSON.stringify({ event: "MessageCreated", data: { messageId: msg.insertedId, chatId: cht._id, createdBy: req.user._id, createdAt: new Date() } }))
            })
            res.status(201).send({ status: 201, chatId: cht._id, messageId: msg.insertedId })
        }
    } catch (err) { makeError(500, res)(err) }
})

export default router;