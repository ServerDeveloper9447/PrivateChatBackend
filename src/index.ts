import { config } from "dotenv";
config()
import http from 'http'
import express from 'express'
import { Request, Response } from "express";
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import errors from './assets/errors.json'
import crypto from 'crypto'
import argon from 'argon2'
import jwt from "jsonwebtoken";
import { z } from "zod";
import cors from 'cors'
export const client = new MongoClient(process.env.MONGO_URI!, { serverApi: { strict: true, deprecationErrors: true, version: ServerApiVersion.v1 } })
export const db = client.db('Primary')
const app = express()
export const server = http.createServer(app)
export const makeError = (status: number, res: Res) => {
    const data = errors.find(err => err.status === status)!
    res.status(data.customStatus == true ? 400 : data.status).send(data)
    return function (error?: any) {
        console.trace(error)
    }
}
import { userSchema, userValidate } from "./validations";
export type User = z.infer<typeof userSchema>;
import users from './user'
import chats from './chat'
declare global {
    namespace Express {
        interface Request {
            user: User & {},
        }
    }
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cors())

export interface Res extends Response {
    status(number: number): any
    send(body: { status: number, [key: string]: any }): any
}

app.get('/', (req: Request, res: Res) => {
    res.send({ status: 200, message: 'Backend Online' })
})

app.get('/stats', async (req: Request, res: Res) => {
    try {
        const users = await db.collection('Users').countDocuments()
        const messages = await db.collection('Messages').countDocuments()
        res.send({ status: 200, data: { users, messages } })
    } catch (err) { makeError(500, res)(err) }
})

const userRegisterSchema = z.object({
    username: z.string(),
    password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/),
    email: z.string().email()
})
const userLoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
})

app.post('/register', (req: Request, res: Res) => {
    try {
        const { username, password, email } = userRegisterSchema.parse(req.body)
        db.collection('Users').findOne({ $or: [{ username }, { email }] })
            .then(async user => {
                if (!user) {
                    const hash = await argon.hash(password)
                    const _id = new ObjectId()
                    const at = jwt.sign({ username, _id }, process.env.AT_SECRET!, { expiresIn: '30d' })
                    const rt = jwt.sign({ username, _id }, process.env.RT_SECRET!, { expiresIn: '30d' })
                    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                        modulusLength: 2048,
                        publicKeyEncoding: { type: 'spki', format: 'pem' },
                        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    });
                    await db.collection('Users').insertOne({
                        _id,
                        username,
                        password: hash,
                        email: { id: email },
                        access_token: at,
                        refresh_token: rt,
                        chatIds: [],
                        createdAt: new Date(),
                        public_key: publicKey
                    })
                    res.status(201).send({ status: 201, access_token: at, refresh_token: rt, private_key: privateKey })
                } else makeError(1005, res)
            })
    } catch (err) {
        makeError(400, res)(err)
    }
})

app.post('/login', (req: Request, res: Res) => {
    try {
        const { email, password } = userLoginSchema.parse(req.body)
        db.collection('Users').findOne({email:{id:email}})
            .then(async user => {
                if (!user) return makeError(1011, res)();
                try {
                    const t = await argon.verify(user.password,password)
                    if(!t) return makeError(1010,res)();
                } catch(err) {
                    return makeError(401,res)(err)
                }
                const _id = user._id.toString()
                const at = jwt.sign({ username: user.username, _id }, process.env.AT_SECRET!, { expiresIn: '30d' })
                const rt = jwt.sign({ username: user.username, _id }, process.env.RT_SECRET!, { expiresIn: '30d' })
                const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                    modulusLength: 2048,
                    publicKeyEncoding: { type: 'spki', format: 'pem' },
                    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                });
                await db.collection('Users').updateOne({ _id: user._id }, { $set: { access_token: at, refresh_token: rt, public_key: publicKey } })
                res.send({ status: 200, _id: user._id, access_token: at, refresh_token: rt, private_key: privateKey })
            })
    } catch (err) { makeError(400, res)(err) }
})

app.post('/refresh_tokens', (req: Request,res: Res) => {
    try {
        const { refresh_token: ref } = req.body
        const { _id } = jwt.verify(ref, process.env.RT_SECRET!) as { _id: string }
        if (!_id) return makeError(401, res)();
        db.collection('Users').findOne({ _id: new ObjectId(_id) })
            .then(async user => {
                if (!user) return makeError(401, res)();
                if (user.refresh_token !== ref) return makeError(1007, res);
                const at = jwt.sign({ username: user.username, _id: user._id }, process.env.AT_SECRET!, { expiresIn: '30d' })
                const rt = jwt.sign({ username: user.username, _id: user._id }, process.env.RT_SECRET!, { expiresIn: '30d' })
                await db.collection('Users').updateOne({ _id: user._id }, { $set: { access_token: at, refresh_token: rt } })
                res.send({ status: 200, access_token: at, refresh_token: rt })
            })
    } catch (err) {
        makeError(401, res)(err)
    }
})

app.use('/users', userValidate, users)
app.use('/chats', userValidate, chats)

server.listen(process.env.PORT || 3000, () => console.log(`Listening on http://localhost:${process.env.PORT || 3000}`))