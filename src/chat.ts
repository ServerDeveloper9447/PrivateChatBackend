import express from 'express'
import { db, makeError, Res } from '.'
import { ObjectId, PushOperator } from 'mongodb'
import { chatsSchema, messageSchema } from './validations'
import { connections } from './ws'

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
        if (!parsed.memberIds.includes(req.user._id) || parsed.memberIds.length < 2 || parsed.createdBy !== req.user._id || [...new Set(parsed.memberIds)].filter(x => x !== req.user._id).includes(req.user._id)) return makeError(400, res);
        if (parsed.direct == true) return makeError(1008, res);
        let precheck = await chatdb.findOne({ _id: parsed._id })
        if (precheck != null) return makeError(409, res);
        if([...new Set(parsed.memberIds)].length !== parsed.memberIds.length) return makeError(1009, res);
        let users = await userdb.countDocuments({ _id: { $in: parsed.memberIds } })
        if(users != parsed.memberIds.length) return makeError(404, res);
        const nchat = await chatdb.insertOne(parsed)
        await userdb.updateMany({_id:{$in:parsed.memberIds}},{$push:{chatIds:nchat.insertedId}} as PushOperator<Document>)
        res.send({ status: 200, chatId: nchat.insertedId })
    } catch (err) { makeError(400, res)(err) }
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
        if(message.createdBy != req.user._id || message.chatId == req.user._id) return makeError(400,res);
        let cht = await chatdb.findOne({ _id: message.chatId })
        if (!cht) {
            const user = await userdb.findOne({ _id: message.chatId })
            if (!user) return makeError(1006, res);
            const msg = await messages.insertOne(message)
            let chat = await chatdb.insertOne({ avatar: req.user.avatar, direct: true, createdBy: req.user._id, messageIds: [msg.insertedId], memberIds: [user._id, req.user._id] })
            await userdb.updateMany({ _id: { $in: [req.user._id, user._id] } }, { $push: { chatIds: chat.insertedId } } as PushOperator<Document>)
            connections.find(x => x.user._id == user._id)?.ws?.send(JSON.stringify({ event: "ChatCreated", data: { avatar: req.user.avatar, direct: true, createdBy: req.user._id, messageIds: [msg.insertedId], memberIds: [user._id, req.user._id], createdAt: new Date() } }));
            return res.send({ status: 200, messageId: msg.insertedId, chatId: chat.insertedId })
        } else {
            const msg = await messages.insertOne(message)
            cht?.memberIds?.forEach((x: ObjectId) => {
                if (x == req.user._id) return;
                connections.find(cn => cn.user._id == x)?.ws?.send(JSON.stringify({ event: "MessageCreated", data: { messageId: msg.insertedId, chatId: cht._id, createdBy: req.user._id, createdAt: new Date() } }))
            })
            res.send({ status: 200, chatId: cht._id, messageId: msg.insertedId })
        }
    } catch (err) { makeError(500, res)(err) }
})

export default router;