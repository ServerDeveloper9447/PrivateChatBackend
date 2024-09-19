import { config } from "dotenv";
config()
import express from 'express'
import { Request, Response } from "express";
import {MongoClient, ObjectId, ServerApiVersion} from 'mongodb'
import * as errors from './errors.json'
import crypto from 'crypto'
const client = new MongoClient(process.env.MONGO_URI!,{serverApi:{strict:true,deprecationErrors:true,version:ServerApiVersion.v1}})
export const db = client.db('Primary')
export const makeError = (status:number,res:Res) => {
    return function(error?:any) {
        console.trace(error)
        const data = errors.find(err => err.status === status)!
        res.status(data.customStatus == true ? 200 : data.status).send(data)
    }
}
import users from './user'
import chats from './chat'
import { z } from "zod";
import { userValidate } from "./validations";

const app = express()

export type User = {
    "_id": ObjectId,
    "username": String,
    "avatar"?: String,
    "email": {
        id: String,
        verified?: Boolean
    },
    "about"?: String,
    "public_key": String,
    "chatIds": String[] | [],
    "createdAt": Date,
    "banned"?: Boolean
}

declare global {
    namespace Express {
        interface Request {
            user: User | null
        }
    }
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }));

export interface Res extends Response {
    send(body: {status:number, [key:string]:any}):any
}

app.get('/', (req:Request, res:Res) => {
    res.send({status: 200, message: 'Backend Online'})
})

app.get('/stats',async (req:Request,res:Res) => {
    try {
        const users = await db.collection('Users').countDocuments()
        const messages = await db.collection('Messages').countDocuments()
        res.send({status: 200, data: {users, messages}})
    } catch(err) {makeError(500,res)(err)}
})

const userRegisterSchema = z.object({
    username: z.string(),
    password: z.string().min(8,"Password must be 8 characters long."),
    email: z.string().email()
})

app.post('/register',(req:Request,res:Res) => {
    try {
        const {username,password,email} = userRegisterSchema.parse(req.body)
        db.collection('Users').findOne({$or:[{username},{email}]})
        .then(user => {
            if(!user) {
                const salt = crypto.randomBytes(16)
                crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, hash) => {
                    if(err) return makeError(500,res)(err);
                    const at = crypto.randomBytes(32).toString('hex')
                    const rt = crypto.randomBytes(32).toString('hex')
                    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                        modulusLength: 2048,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    });
                    db.collection('Users').insertOne({
                        username,
                        password: hash.toString('hex'),
                        pass_salt: salt,
                        email: {id:email},
                        access_token: at,
                        refresh_token: rt,
                        chatIds: [],
                        createdAt: new Date(),
                        public_key: publicKey
                    })
                    .then(() => res.send({status: 200, access_token:at, refresh_token:rt, public_key: publicKey, private_key:privateKey}))
                    .catch(makeError(500,res))
                })
            } else makeError(1005,res)()
        })
    } catch(err) {
        makeError(400,res)(err)
    }
})

app.post('/refresh_tokens',async (req:Request,res:Res) => {
    try {
        const {refresh_token:ref} = req.body
        db.collection('Users').findOne({ref})
        .then(user => {
            if(!user) return makeError(401,res)()
            const at = crypto.randomBytes(32).toString('hex')
            const rt = crypto.randomBytes(32).toString('hex')
            db.collection('Users').updateOne({_id:user._id},{$set:{access_token:at,refresh_token:rt}})
            .then(() => res.send({status:200,access_token:at,refresh_token:rt}))
            .catch(makeError(500,res))
        })
    } catch(err) {
        makeError(401,res)(err)
    }
})

app.use('/users',userValidate,users)
app.use('/chats',userValidate,chats)

app.listen(process.env.PORT || 3000, () => console.log("Backend Online"))