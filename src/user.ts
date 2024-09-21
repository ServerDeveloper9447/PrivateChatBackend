import * as express from 'express'
import { db, makeError, Res, User } from '.'
import { ObjectId } from 'mongodb'
const router = express.Router()
const users = db.collection('Users')
const chats = db.collection('Chats')

router.get('/',(req:express.Request,res:Res) => {
    users.findOne({_id:new ObjectId(req.user!._id)},{projection:{username:1,avatar:1,public_key:1,about:1,createdAt:1}})
        .then(val => !val ? makeError(404,res)() : res.send({status:200,user:val}))
        .catch(makeError(500,res))
})

router.get('/search',async (req:express.Request,res:Res) => {
    if(!req.query.username) return makeError(400,res);
    try {
        const user = await users.findOne({username:req.query.username},{projection:{username:1,avatar:1,about:1,createdAt:1,banned:1,public_key:1}})
        if(!user) return makeError(404,res);
        return res.send({status:1,user})
    } catch(err) {makeError(500,res)(err)}
})

router.get('/chats',async (req:express.Request,res:Res) => {
    try {
        const groups = await chats.find({_id:{$in:req.user.chatIds}}).toArray()
        res.send({status:200,chatIds:groups})
    } catch(err) {makeError(500,res)}
})



export default router;