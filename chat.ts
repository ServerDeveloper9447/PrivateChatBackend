import express from 'express'
import { db, makeError, Res } from '.'
import { ObjectId } from 'mongodb'

const router = express.Router()
const users = db.collection('Users')
const chatdb = db.collection('Chats')
const messages = db.collection('Messages')

router.get('/',(req:express.Request,res:Res) => {
    users.findOne({_id:new ObjectId(req.params.id)},{projection:{chats:1}})
    .then(user => {
        const {chatIds} = user!
        if(!chatIds) return res.send({status:200,chats:[]});
        chatdb.find({_id:{$in:chatIds}},{projection:{name:1,avatar:1}}).toArray()
        .then(chats => res.send({status:200,chats}))
        .catch(makeError(500,res))
    }).catch(makeError(500,res))
})

router.post('/:id',(req:express.Request,res:Res) => {
    chatdb.findOne({_id:new ObjectId(req.params.id)})
    .then(chat => {
        if(!chat) return makeError(404,res)();
        messages.find({_id:{$in:[].concat(chat.messages).map(x => new ObjectId(x as string))}}).toArray()
        .then(msgs => {
            delete chat.messageIds;
            chat.messages = msgs
            res.send({status:200,chat})
        }).catch(makeError(500,res))
    }).catch(makeError(500,res))
})

export default router;