import express from 'express'
import { client, db, makeError, Res } from '.'
import { ObjectId, PushOperator } from 'mongodb'
import { messageSchema } from './validations'

const router = express.Router()
const chatdb = db.collection('Chats')
const messages = db.collection('Messages')
const userdb = db.collection('User')

router.get('/',async (req:express.Request,res:Res) => {
    const {chatIds} = req.user!
    if(!chatIds) return res.send({status:200,chats:[]});
    try {
        const chats = await chatdb.find({_id:{$in:chatIds}},{projection:{name:1,avatar:1,direct:1,createdBy:1}}).toArray()
        res.send({status:200,chats})
    } catch(err) {makeError(500,res)(err)}
})

router.get('/:id',async (req:express.Request,res:Res) => {
    if(!req.user.chatIds.find(x => x.toString() == req.params.id)) return makeError(403,res); // idk why it doesn't work with .includes(req.params.id)
    try {
    const chat = await chatdb.aggregate([
        {
            $match: {_id:new ObjectId(req.params.id as string)}
        },{
            $lookup: {
                from: 'Messages',
                localField: 'messageIds',
                foreignField: '_id',
                as: 'messages'
            }
        },{
            $project: {
                messageIds: 0
            }
        }
    ]).toArray()
    if(!chat) return makeError(404,res)();
    res.send({status:200,chat})
    } catch(err) {makeError(500,res)(err)}
})

router.post('/:id/messages',async (req:express.Request,res:Res) => {
    try {
        const message = messageSchema.parse(req.body)
        const msg = await messages.insertOne(message)
        let cht = await chatdb.findOneAndUpdate({_id:message.chatId},{$push:{messageIds:msg.insertedId}} as PushOperator<Document>)
        if(!cht) {
            const user = await userdb.findOne({_id:message.chatId})
            if(!user) return makeError(1006,res);
            let chat = await chatdb.insertOne({avatar:req.user.avatar,direct:true,createdBy:req.user._id,messageIds:[msg.insertedId],memberIds:[user._id,req.user._id]})
            await userdb.updateMany({_id:{$in:[req.user._id,user._id]}},{$push:{chatIds:chat.insertedId}} as PushOperator<Document>)
            return res.send({status:200,messageId:msg.insertedId,chatId:chat.insertedId})
        } else {
            res.send({status:200,chatId:cht._id,messageId:msg.insertedId})
        }
    } catch(err) {makeError(500,res)(err)}
})

export default router;