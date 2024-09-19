import * as express from 'express'
import { db, makeError, Res, User } from '.'
import { ObjectId } from 'mongodb'
const router = express.Router()
const users = db.collection('Users')

router.get('/',(req:express.Request,res:Res) => {
    users.findOne({_id:new ObjectId(req.user?._id)},{projection:{username:1,avatar:1,public_key:1,about:1,createdAt:1}})
        .then(val => !val ? makeError(404,res)() : res.send({status:200,user:val}))
        .catch(makeError(500,res))
})

export default router;