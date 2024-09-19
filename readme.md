## Users Schema
```json
{
    "_id": ObjectId,
    "username": String,
    "password": String,
    "pass_salt": String,
    "avatar": "base64string",
    "email": {id:"validated_verified_email",verified:Boolean},
    "about": "max_120_char_string",
    "public_key": String,
    "chatIds": ObjectId[],
    "createdAt": Date,
    "banned": Boolean
}
```
## User Summary Schema
```json
{
    "_id": ObjectId,
    "username": String,
    "avatar"?: String,
    "public_key": String
}
```
## Messages Schema
```json
{
    "_id": ObjectId,
    "content": String,
    "createdAt": String,
    "createdBy": ObjectId,
    "edited": Boolean,
    "read": Boolean,
    "chatId": ObjectId
}
```
## Chats Schema
```json
{
    "_id": ObjectId,
    "createdAt": String,
    "createdBy": ObjectId,
    "messageIds": ObjectId[],
    "avatar": "base64string",
    "memberIds": ObjectId[] | ObjectId,
    "direct": Boolean
}