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
    avatar: z.string(),
    about: z.string().optional(),
    public_key: z.string(),
    chatIds: z.array(z.instanceof(ObjectId)).or(z.tuple([])),
    createdAt: z.date(),
    banned: z.boolean().optional()
})

export const messageSchema = z.object({
    _id: z.instanceof(ObjectId).default(new ObjectId).or(z.string().transform(v => new ObjectId(v))),
    content: z.string().base64(),
    createdAt: z.date().default(new Date()),
    createdBy: z.instanceof(ObjectId).optional(),
    edited: z.boolean().optional(),
    chatId: z.instanceof(ObjectId).optional(),
    read: z.boolean().default(false)
})

export const userValidate = async function (req:Request,res:Res,next:NextFunction) {
    try {
        req.user = userSchema.parse(await users.findOne({access_token:req.headers.authorization?.split(" ")[1]}))
        next()
    } catch(err) {
        makeError(400,res)(err)
    }
}