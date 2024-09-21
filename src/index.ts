import { config } from "dotenv";
config()
import http from 'http'
import express from 'express'
import { Request, Response } from "express";
import {MongoClient, ObjectId, ServerApiVersion} from 'mongodb'
import errors from './assets/errors.json'
import crypto from 'crypto'
import jwt from "jsonwebtoken";
export const client = new MongoClient(process.env.MONGO_URI!,{serverApi:{strict:true,deprecationErrors:true,version:ServerApiVersion.v1}})
export const db = client.db('Primary')
export const makeError = (status:number,res:Res) => {
    const data = errors.find(err => err.status === status)!
    res.status(data.customStatus == true ? 400 : data.status).send(data)
    return function(error?:any) {
        console.trace(error)
    }
}
import users from './user'
import chats from './chat'
import { z } from "zod";
import { userValidate } from "./validations";

const app = express()
export const server = http.createServer(app)
export type User = {
    "_id": ObjectId,
    "username": String,
    "avatar"?: String,
    "email": {
        id: String,
        verified?: Boolean
    },
    "about"?: String,
    "public_key": String
    "chatIds": ObjectId[] | [],
    "createdAt": Date,
    "banned"?: Boolean
}

declare global {
    namespace Express {
        interface Request {
            user: User & {}
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
const userLoginSchema = z.object({
    identifier: z.string().or(z.string().email()),
    password: z.string().min(8,"Password must be 8 characters long.")
})

app.post('/register',(req:Request,res:Res) => {
    try {
        const {username,password,email} = userRegisterSchema.parse(req.body)
        db.collection('Users').findOne({$or:[{username},{email}]})
        .then(async user => {
            if(!user) {
                const salt = crypto.randomBytes(16).toString('hex')
                const hash = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256')
                const _id = new ObjectId()
                const at = jwt.sign({username,_id},process.env.AT_SECRET!,{expiresIn:'30d'})
                const rt = jwt.sign({username,_id},process.env.RT_SECRET!,{expiresIn:'30d'})
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
                await db.collection('Users').insertOne({
                    _id,
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
                res.send({status: 200, access_token:at, refresh_token:rt, private_key:privateKey})
            } else makeError(1005,res)
        })
    } catch(err) {
        makeError(400,res)(err)
    }
})

app.post('/login',(req:Request,res:Res) => {
    try {
        const {identifier,password} = userLoginSchema.parse(req.body)
        db.collection('Users').findOne({$or:[{username:identifier},{email:{id:identifier}}]})
        .then(async user => {
            if(!user) return makeError(401,res)();
            const hash = crypto.pbkdf2Sync(password, user.pass_salt, 310000, 32, 'sha256')
            if(hash.toString('hex') !== user.password) return makeError(401,res);
            const _id = user._id.toString()
            const at = jwt.sign({username:user.username,_id},process.env.AT_SECRET!,{expiresIn:'30d'})
            const rt = jwt.sign({username:user.username,_id},process.env.RT_SECRET!,{expiresIn:'30d'})
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            await db.collection('Users').updateOne({_id:user._id},{$set:{access_token:at,refresh_token:rt,public_key:publicKey}})
            res.send({status:200,_id:user._id,access_token:at,refresh_token:rt,private_key:privateKey})
        })
    } catch(err) {makeError(400,res)(err)}
})

app.post('/refresh_tokens',async (req:Request,res:Res) => {
    try {
        const {refresh_token:ref} = req.body
        const {_id} = jwt.verify(ref,process.env.RT_SECRET!) as {_id:string}
        if(!_id) return makeError(401,res);
        db.collection('Users').findOne({_id:new ObjectId(_id)})
        .then(async user => {
            if(!user) return makeError(401,res)()
            if(user.refresh_token !== ref) return makeError(1007,res);
            const at = jwt.sign({username:user.username,_id:user._id},process.env.AT_SECRET!,{expiresIn:'30d'})
            const rt = jwt.sign({username:user.username,_id:user._id},process.env.RT_SECRET!,{expiresIn:'30d'})
            await db.collection('Users').updateOne({_id:user._id},{$set:{access_token:at,refresh_token:rt}})
            res.send({status:200,access_token:at,refresh_token:rt})
        })
    } catch(err) {
        makeError(401,res)(err)
    }
})

app.use('/users',userValidate,users)
app.use('/chats',userValidate,chats)

server.listen(process.env.PORT || 3000, () => console.log("Backend Online"))