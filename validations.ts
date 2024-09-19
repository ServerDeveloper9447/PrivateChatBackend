import { db, makeError, Res } from ".";
import { z } from "zod";
import { NextFunction, Request } from "express";
import { ObjectId } from "mongodb";

const users = db.collection('Users')

const userSchema = z.object({
    username: z.string(),
    email: z.object({
        id: z.string().email(),
        verified: z.boolean().optional()
    }),
    avatar: z.string(),
    _id: z.instanceof(ObjectId),
    about: z.string().optional(),
    public_key: z.string(),
    chatIds: z.array(z.string()).or(z.tuple([])),
    createdAt: z.date(),
    banned: z.boolean().optional()
})

export const userValidate = async function (req:Request,res:Res,next:NextFunction) {
    try {
        req.user = userSchema.parse(await users.findOne({access_token:req.headers.authorization?.split(" ")[1]}))
        next()
    } catch(err) {
        req.user = null
        makeError(400,res)(err)
    }
}