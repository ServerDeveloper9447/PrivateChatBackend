import express, { NextFunction } from 'express'
import { client, db, makeError, Res } from '.'
import { ObjectId, PushOperator } from 'mongodb'
import { messageSchema } from './validations'

const router = express.Router()
const chatdb = db.collection('Chats')
const messages = db.collection('Messages')

router.get('/',(req:express.Request,res:Res) => {
    const {chatIds} = req.user!
    if(!chatIds) return res.send({status:200,chats:[]});
    chatdb.find({_id:{$in:chatIds}},{projection:{name:1,avatar:1}}).toArray()
    .then(chats => res.send({status:200,chats}))
    .catch(makeError(500,res))
})

router.post('/:id',(req:express.Request,res:Res) => {
    chatdb.findOne({_id:new ObjectId(req.params.id)})
    .then(chat => {
        if(!chat) return makeError(404,res)();
        messages.find({_id:{$in:chat.messageIds}}).toArray()
        .then(msgs => {
            delete chat.messageIds;
            chat.messages = msgs
            res.send({status:200,chat})
        }).catch(makeError(500,res))
    }).catch(makeError(500,res))
})

router.post('/messages',(req:express.Request,res:Res) => {
    try {
        const message = messageSchema.parse(req.body)
        const session = client.startSession()
        session.withTransaction(async () => {
            const msg = await messages.insertOne(message, {session})
            await chatdb.updateOne({_id:message.chatId},{"$push":{messageIds:msg.insertedId}} as unknown as PushOperator<Document>,{session})
            res.send({status:200,messageId:msg.insertedId})
        },{
            readPreference: 'primary',
            readConcern: { level: 'local' },
            writeConcern: { w: 'majority' }
          }).catch(makeError(500,res))
    } catch(err) {makeError(500,res)(err)}
})

export default router;