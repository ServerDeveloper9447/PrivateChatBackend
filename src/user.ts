import * as express from 'express'
import { db, makeError, Res, User } from '.'
import { ObjectId } from 'mongodb'
const router = express.Router()
const users = db.collection('Users')
const chats = db.collection('Chats')
const message = db.collection('Messages')

router.get('/',(req:express.Request,res:Res) => {
    users.findOne({_id:new ObjectId(req.user!._id)},{projection:{username:1,avatar:1,public_key:1,about:1,createdAt:1}})
        .then(val => !val ? makeError(404,res)() : res.send({status:200,user:val}))
        .catch(makeError(500,res))
})

router.get('/chats',async (req:express.Request,res:Res) => {
    try {
        const [groups,dms] = await Promise.all([chats.find({_id:{$each:req.user.chatIds}}).toArray(),message.find({reciepent:req.user._id}).toArray()])
        
    } catch(err) {makeError(500,res)}
})

export default router;