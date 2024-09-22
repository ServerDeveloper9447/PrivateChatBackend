import * as express from 'express'
import { db, makeError, Res } from '.'
import { PullOperator } from 'mongodb'
const router = express.Router()
const users = db.collection('Users')
const chats = db.collection('Chats')

router.get('/',(req:express.Request,res:Res) => {
    res.send({status:200,user:req.user})
})

router.get('/search',async (req:express.Request,res:Res) => {
    if(!req.query.username) return makeError(400,res);
    if(req.query.username == req.user.username) return res.send({status:200,user:req.user});
    try {
        const user = await users.findOne({username:req.query.username},{projection:{username:1,avatar:1,about:1,createdAt:1,banned:1,public_key:1}})
        if(!user) return makeError(404,res);
        return res.send({status:200,user})
    } catch(err) {makeError(500,res)(err)}
})

router.get('/chats',async (req:express.Request,res:Res) => {
    try {
        const groups = await chats.find({_id:{$in:req.user.chatIds}}).toArray()
        res.send({status:200,chatIds:groups})
    } catch(err) {makeError(500,res)}
})

router.delete('/',async (req:express.Request,res:Res) => {
    try {
        await chats.updateMany({_id:{$in:req.user.chatIds}},{ $pull: { memberIds: req.user._id } } as PullOperator<Document>)
        await users.deleteOne({_id:req.user._id})
        res.status(204).send({status:204})
    } catch(err) {makeError(500,res)(err)}
})

export default router;