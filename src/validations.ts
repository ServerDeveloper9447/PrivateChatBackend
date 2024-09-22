import { db, makeError, Res } from ".";
import { z } from "zod";
import { NextFunction, Request } from "express";
import { ObjectId } from "mongodb";

const users = db.collection('Users')

export const userSchema = z.object({
    _id: z.instanceof(ObjectId).default(new ObjectId).or(z.string().transform(v => new ObjectId(v))),
    username: z.string(),
    email: z.object({
        id: z.string().email(),
        verified: z.boolean().optional()
    }),
    avatar: z.string().optional(),
    about: z.string().optional(),
    public_key: z.string(),
    chatIds: z.array(z.instanceof(ObjectId)).or(z.tuple([])).default([]),
    createdAt: z.date(),
    banned: z.boolean().optional(),
    access_token: z.string(),
    refresh_token: z.string()
})

export const messageSchema = z.object({
    _id: z.instanceof(ObjectId).default(new ObjectId).or(z.string().transform(v => new ObjectId(v))),
    content: z.string().base64(),
    createdAt: z.date().default(new Date()).or(z.string().transform(v => new Date(v))),
    createdBy: z.instanceof(ObjectId).or(z.string().transform(v => new ObjectId(v))),
    edited: z.boolean().optional(),
    chatId: z.instanceof(ObjectId).or(z.string().transform(v => new ObjectId(v))).optional(),
    readBy: z.array(z.instanceof(ObjectId)).or(z.tuple([])).default([])
})

export const chatsSchema = z.object({
    _id: z.instanceof(ObjectId).default(new ObjectId).or(z.string().transform(v => new ObjectId(v))),
    name: z.string().optional(),
    messageIds: z.array(z.instanceof(ObjectId)).or(z.tuple([])).default([]),
    createdAt: z.date().default(new Date()).or(z.string().transform(v => new Date(v))),
    createdBy: z.instanceof(ObjectId).or(z.string().transform(v => new ObjectId(v))),
    avatar: z.string().optional(),
    direct: z.boolean().default(false),
    memberIds: z.array(z.instanceof(ObjectId)).or(z.array(z.string()).transform(v => v.map(x => new ObjectId(x))))
})

export const userValidate = async function (req: Request, res: Res, next: NextFunction) {
    try {
        const user = await users.findOne({ access_token: req.headers.authorization?.split(" ")[1] })
        if (!user) return makeError(401, res);
        req.user = userSchema.parse(user)
        next()
    } catch (err) {
        makeError(400, res)(err)
    }
}